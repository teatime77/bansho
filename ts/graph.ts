/// <reference path="main.ts" />
namespace bansho{
declare var Viz: any;

export let mapSel   : HTMLSelectElement;
export let docsDlg : HTMLDialogElement;
export let docsTbl : HTMLTableElement;
export let docClickCallBack : (src: HTMLElement, id: number)=>void;

let mapDiv : HTMLDivElement;

let mapId      : number;
let mapDocs    : FileInfo[] = [];
let mapDocsTmp : FileInfo[];
let mapEdges   : Edge[] = [];
let goalIds  : number[] = [];
let pathIds  : number[] = [];
let args     : string[] = [];
let URLs     : { [id: number]: string; } = {};

let srcDoc : FileInfo | null = null;
let srcG   : SVGElement;

class Edge {
    srcId!: number;
    dstId!: number;
    label!: string;
}

function setPathIds(){
    pathIds = [];
    let pendings : number[] = goalIds.slice();

    while(pendings.length != 0){
        let id = pendings.pop()!;

        pathIds.push(id);

        let srcIds = mapEdges.filter(x => x.dstId == id && ! pathIds.includes(x.srcId)).map(x => x.srcId);
        pendings.push(... Array.from(new Set(srcIds)));
    }
}

function setPathColor(oldPathIds : number[]){
    for(let id of new Set(oldPathIds.concat(pathIds))){
        let box = getElement(`${id}`);
        let ellipse = getChildNode(box as unknown as SVGGElement, "ellipse");
        if(pathIds.includes(id)){
            ellipse!.setAttribute("fill", "aqua");
        }
        else{
            ellipse!.setAttribute("fill", "white");
        }
    }
}

function getChildNode(g : SVGGElement, nodeName: string){
    for(let nd of g.childNodes){
        if(nd.nodeName == nodeName){

            return nd as SVGElement;
        }
    }
    throw new Error();
}

function openUrl(inf: FileInfo){
    const fnc = (text: string)=>{
        let doc = JSON.parse(text);

        if(doc.youtube != undefined){

            window.open(`https://youtu.be/${doc.youtube}`, '_blank');
        }
        else{

            window.open(`play.html?id=${inf.id}`, '_blank');
        }
    };

    if(Glb.getJsonFile){

        fetchText(`json/${inf.id}.json`, (text: string)=>{
            let data = JSON.parse(text);
            fnc(data.text);
        });
    }
    else{

        fetchDB(`${inf.id}`, (id: string | null, data: any)=>{
            fnc(data.text);
        });    
    }
}

function setMapSvgEvent(){
    for(let doc of mapDocs){
        let box = getElement(`${doc.id}`);

        box.addEventListener("click", function(ev:MouseEvent){

            let doc_id = parseInt(this.id)
            let doc1 = mapDocs.find(x => x.id == doc_id);
            if(doc1 == undefined){
                throw new Error();
            }
            console.log(`click ${doc1.id} ${doc1.title}`);

            if(!Glb.edit){

                if(ev.ctrlKey){

                    window.open(`edit.html?id=${doc1.id}`, '_blank');
                }
                else{

                    openUrl(doc1);
                }
                return;
            }

            let ellipse = getChildNode(this as unknown as SVGGElement, "ellipse");

            if(ev.ctrlKey){

                if(srcDoc == null){

                    srcDoc = doc1;
                    srcG   = ellipse!;
                    ellipse!.setAttribute("fill", "aqua");
                }
                else{
                    let edge = {
                        srcId: srcDoc.id,
                        dstId: doc1.id,
                        label: ""
                    } as Edge;
                    mapEdges.push(edge);
                    makeDot();

                    srcG.setAttribute("fill", "white");
                    srcDoc = null;
                }
            }
            else if(ev.shiftKey){
                if(goalIds.includes(doc1.id)){
                    removeArrayElement(goalIds, doc1.id);
                }
                else{
                    goalIds.push(doc1.id);
                }

                let oldPathIds = pathIds;
                setPathIds();
                setPathColor(oldPathIds);
            }
            else{

                window.open(`edit.html?id=${doc1.id}`, '_blank');
            }
        });
    }
    
    for(let edge of mapEdges){
        let dom = getElement(`${edge.srcId}:${edge.dstId}`);
        if(dom == null){
            console.log(`err edge ${edge.srcId}:${edge.dstId}`);
            continue;
        }

        if(Glb.edit){

            let path = getChildNode(dom as unknown as SVGGElement, "path");
            path.setAttribute("stroke-width", "3");
            path.style.cursor = "pointer";
        }

        dom.addEventListener("click", function(ev:MouseEvent){
            if(! ev.ctrlKey){
                return;
            }

            let v = this.id.split(':');
            let [srcId, dstId] = v.map(x => parseInt(x));

            let srcDoc = indexFile.docs.find(x => x.id == srcId)!;
            let dstDoc = indexFile.docs.find(x => x.id == dstId)!;
            if(srcDoc == undefined || dstDoc == undefined){
                throw new Error();
            }

            console.log(`click ${srcId}:${srcDoc.title} -> ${dstId}:${dstDoc.title}`);
            msgBox(`${srcDoc.title} から ${dstDoc.title} へのリンクを削除しますか?`, ()=>{
                console.log(`OK ${srcId}:${srcDoc.title} -> ${dstId}:${dstDoc.title}`);

                let edge = mapEdges.find(x => x.srcId == srcId && x.dstId == dstId);
                removeArrayElement(mapEdges, edge);
                makeDot();
            })
        });
    }
}

function makeDot(){
    let docLines  : string[] = [];
    let edgeLines : string[] = [];

    for(let doc of mapDocs){
        let url = URLs[doc.id];

        let id = (url != undefined ? `be/${url}` : `${doc.id}`);
        let color = (doc.len != 0 ? `, fontcolor="blue"` : "");

        docLines.push(`b${doc.id} [ label="${doc.title}", id="${id}", class="doc", tooltip="　" ${color} ];` );
    }

    for(let edge of mapEdges){
        let id = `${edge.srcId}:${edge.dstId}`;
        edgeLines.push(`b${edge.srcId} -> b${edge.dstId} [ id="${id}" ];`);
    }

    let dot = `
    digraph graph_name {
        graph [
            rankdir = BT;
            charset = "UTF-8";
        ];
        ${docLines.join('\n')}
        ${edgeLines.join('\n')}
    }
    `;

    if(args.includes("dot")){
        console.log(dot);
    }

    var viz = new Viz();

    viz.renderSVGElement(dot)
    .then(function(element: any) {
        mapDiv.innerHTML = "";
        mapDiv.appendChild(element);
        setMapSvgEvent();
    })
    .catch((error:any) => {
        // Create a new Viz instance (@see Caveats page for more info)
        viz = new Viz();

        // Possibly display the error
        console.error(error);
    });

}

function setMapDocs(){
    mapEdges = mapEdges.filter(edge => indexFile.docs.some(doc => doc.id == edge.srcId) && indexFile.docs.some(doc => doc.id == edge.dstId));

    let src_ids = mapEdges.map(x => x.srcId);
    let dst_ids = mapEdges.map(x => x.dstId);

    let ids = new Set(src_ids.concat(dst_ids));
    
    mapDocs = indexFile.docs.filter(doc => ids.has(doc.id));

    if(!Glb.edit && goalIds.length != 0){
        // ゴールの文書IDが指定されている場合

        setPathIds();

        mapDocs = mapDocs.filter(x => pathIds.includes(x.id));

        mapEdges = mapEdges.filter(edge => mapDocs.some(doc => doc.id == edge.srcId) && mapDocs.some(doc => doc.id == edge.dstId));

        if(args.includes("dot")){
            let infs : FileInfo[] = mapDocs.slice();
            let fnc = ()=>{

                if(infs.length == 0){

                    console.log(`未 : 終了`);
                    makeDot();
                    return;
                }
                let inf = infs.pop()!;

                fetchDB(`${inf.id}`, (id: string | null, data: any)=>{
                    let doc = JSON.parse(data.text);

                    if(doc.youtube == undefined){
            
                        console.log(`未 : ${inf.title}`);
                    }
                    else{

                        URLs[inf.id] = doc.youtube;
                    }
                    fnc();
                });    
                    
            }
            fnc();
            return;
        }
    }
        
    makeDot();
}

export function getMap(map_id: number){
    if(Glb.getJsonFile){

        fetchText(`json/${map_id}.json`, (text: string)=>{
            let obj = JSON.parse(text);
            mapEdges = JSON.parse(obj.text).edges;
            setMapDocs();
        });
    }
    else{

        fetchDB(`${map_id}`, (id: string | null, data:any)=>{
            mapId   = parseInt(id!);
            if(isNaN(mapId)){
                throw new Error();
            }
            let obj = JSON.parse(data.text);
            mapEdges = obj.edges;
            setMapDocs();
        });
    }

}


export function newMap(){
    mapDocs  = [];
    mapEdges = [];
    mapDiv.innerHTML = "";
}


export function putMap(){
    let map_data = {
        text : JSON.stringify({ edges: mapEdges })
    }
    
    let log = `[${mapId}]にマップを書き込みました。`;
    writeDB(
        `${mapId}`, map_data, log,
        ()=>{
            alert(log);
        }
    );
}

export function delMap(){
}

export function setDocsTbl(){
    let tr : HTMLTableRowElement;
    docsTbl.innerHTML = "";

    if(indexFile.docs.length == 0){
        return;
    }
    indexFile.docs.sort((x: any, y: any)=>x.title.localeCompare(y.title, 'ja'));

    let ncol = 8;
    let nrow = Math.ceil(indexFile.docs.length / ncol);
    for(let row of range(nrow)){
        tr = document.createElement("tr");
        docsTbl.appendChild(tr);
        for(let col of range(ncol)){
            let idx = col * nrow + row;
            if(indexFile.docs.length <= idx){
                break;
            }

            let doc = indexFile.docs[idx];

            let td = document.createElement("td");
            td.id = `td-${doc.id}`;
            td.addEventListener("click", function(ev: MouseEvent){
                let id = parseInt(td.id.substring(3));
                docClickCallBack(this, id);
            });
            td.innerHTML = doc.title;

            tr!.appendChild(td);
        }
    }
}

function initMapByIndex(){
    indexFile.docs.sort((x: any, y: any)=>x.title.localeCompare(y.title, 'ja'));

    if(indexFile.maps.length == 1 || ! Glb.edit){
        getMap(indexFile.maps[0].id);
    }
    if(! Glb.edit){
        return;
    }

    getElement("map-edit").style.display = "block";

    setDocsTbl();
    
    for(let map of indexFile.maps){
        let opt = document.createElement("option");
        opt.value = `${map.id}`;
        opt.innerHTML = map.title;

        mapSel.appendChild(opt);
    }
}

export function showDocsDlg(){
    mapDocsTmp = mapDocs.slice();

    docClickCallBack = function(td: HTMLElement, id: number){
        let doc2 = indexFile.docs.find(x => x.id == id)!;

        if(mapDocsTmp.includes(doc2)){

            removeArrayElement(mapDocsTmp, doc2);
            td.style.backgroundColor = "white";
        }
        else{

            mapDocsTmp.push(doc2);
            td.style.backgroundColor = "lightgrey";
        }
    }

    docsDlg.showModal();
}

export function docsDlgOk(){
    docsDlg.close();
    mapDocs = mapDocsTmp;
    makeDot();
}

export function initGraph(){
    console.log("body load");

    let k1 = window.location.href.indexOf("graph.html?");
    if(k1 != -1){
        args = window.location.href.substring(k1 + "graph.html?".length).split("&");
    }

    let edit = args.includes("edit");

    if(edit || args.includes("app")){

        getElement("div-app").style.display = "block";
        document.title = "数学・物理・AIの依存関係のグラフ";
    }
    else{

        getElement("div-video").style.display = "block";

        goalIds = [ 44 ];
    }

    if(!edit){

        let ids = args.find(x => x.startsWith("ids="));
        if(ids != undefined){
            goalIds = ids.substring(4).split(",").map(x => parseInt(x));
        }
    }

    initBansho(edit);

    mapSel = getElement("map-sel") as HTMLSelectElement;
    mapDiv = getElement("map-div") as HTMLDivElement;

    docsDlg = getElement("docs-dlg") as HTMLDialogElement;
    docsTbl = getElement("docs-tbl") as HTMLTableElement;

    msg(`init graph edit:${Glb.edit}`);

    setMsgBoxEventListener();

    if(Glb.getJsonFile){
        fetchText("json/index.json", (text: string)=>{
            indexFile = JSON.parse(text);
            initMapByIndex();
        });
    }
    else{

        initFirebase(()=>{
            initMapByIndex();
        });
    }

    setGraphEventListener();
}


}
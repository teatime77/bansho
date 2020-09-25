/// <reference path="main.ts" />
namespace bansho{
declare var Viz: any;

export let mapSel   : HTMLSelectElement;
export let docsDlg : HTMLDialogElement;
export let docsTbl : HTMLTableElement;
export let docClickCallBack : (src: HTMLElement, id: number)=>void;

let mapTitle : HTMLInputElement;
let mapDiv : HTMLDivElement;

let skipIds = [ 182, 1, 8, 154, 155, 153, -100, -101, -102 ];
let skipIds2 = skipIds.map(x => `${x}`);

let mapDocs    : FileInfo[] = [];
let mapDocsTmp : FileInfo[];
let mapEdges   : Edge[] = [];

let srcDoc : FileInfo | null = null;
let srcG   : SVGElement;


class Edge {
    srcId!: number;
    dstId!: number;
    label!: string;
}


function setMapSvgEvent(){
    for(let doc of mapDocs){
        if(skipIds.includes(doc.id) || skipIds2.includes(doc.id as unknown as string )){
            continue;
        }
        let box = getElement(`${doc.id}`);
        box.addEventListener("click", function(ev:MouseEvent){
            if(! Glb.edit){
                return;
            }

            let doc_id = parseInt(this.id)
            let doc1 = mapDocs.find(x => x.id == doc_id);
            if(doc1 == undefined){
                throw new Error();
            }
            console.log(`click ${doc1.id} ${doc1.title}`);

            let g = this as unknown as SVGGElement;
            let ellipse : SVGEllipseElement;
            for(let nd of g.childNodes){
                console.log(`${nd.nodeName}`);
                if(nd.nodeName == "ellipse"){

                    ellipse = nd as SVGEllipseElement;
                    break;
                }
            }
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
            else{

                window.open(`play.html?id=${doc1.id}`, '_blank');
            }
        });
    }
    
    for(let edge of mapEdges){
        if(skipIds.includes(edge.srcId) || skipIds.includes(edge.dstId)){
            continue;
        }
        let dom = getElement(`${edge.srcId}:${edge.dstId}`);
        if(dom == null){
            console.log(`err edge ${edge.srcId}:${edge.dstId}`);
            continue;
        }
        dom.addEventListener("click", function(ev:MouseEvent){
            let v = this.id.split(':');
            let [srcId, dstId] = v.map(x => parseInt(x));
            console.log(`click ${srcId} -> ${dstId}`);
        });
    }
}

function makeDot(){
    let docLines  : string[] = [];
    let edgeLines : string[] = [];

    for(let doc of mapDocs){
        docLines.push(`b${doc.id} [ label="${doc.title}", id="${doc.id}" ];` );
    }

    for(let edge of mapEdges){
        if(skipIds.includes(edge.srcId) || skipIds.includes(edge.dstId)){
            continue;
        }

        let id = `${edge.srcId}:${edge.dstId}`;
        edgeLines.push(`b${edge.srcId} -> b${edge.dstId} [ id="${id}" ];`);
    }

    let dot = `
    digraph graph_name {
        graph [
          charset = "UTF-8";
        ];
        ${docLines.join('\n')}
        ${edgeLines.join('\n')}
    }
    `;

    var viz = new Viz();

    // dot = 'digraph { a -> b }';
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
    let src_ids = mapEdges.map(x => x.srcId);
    let dst_ids = mapEdges.map(x => x.dstId);

    let ids = new Set(src_ids.concat(dst_ids));
    
    mapDocs = indexFile.docs.filter(doc => ids.has(doc.id));
}

export function getMap(map_id: number){
    if(Glb.getJsonFile){

        fetchText(`json/${map_id}.json`, (text: string)=>{
            let obj = JSON.parse(text);
            mapEdges = JSON.parse(obj.text).edges;
            setMapDocs();
            makeDot();
        });
    }
    else{

        fetchDB(`${map_id}`, (id: string | null, data:any)=>{
            let obj = JSON.parse(data.text);
            mapEdges = obj.edges;
            setMapDocs();
            makeDot();
            // initEdges(obj.edges);
        });
    }

}


export function newMap(){
    mapDocs  = [];
    mapEdges = [];
    mapDiv.innerHTML = "";
}


export function putMap(){
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

    initBansho(window.location.href.includes("?edit=true"));

    mapSel = getElement("map-sel") as HTMLSelectElement;
    mapTitle = getElement("map-title") as HTMLInputElement;
    mapDiv = getElement("map-div") as HTMLDivElement;

    docsDlg = getElement("docs-dlg") as HTMLDialogElement;
    docsTbl = getElement("docs-tbl") as HTMLTableElement;

    msg(`init graph edit:${Glb.edit}`);

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
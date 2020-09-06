/// <reference path="main.ts" />
namespace bansho{
declare var MathJax:any;
declare var dagre:any;
declare var Viz: any;

const padding = 10;

export let mapSel   : HTMLSelectElement;
let mapTitle : HTMLInputElement;
export let mapDlg : HTMLDialogElement;
let mapTbl : HTMLTableElement;
let mapDiv : HTMLDivElement;

var dom_list : (HTMLElement | SVGSVGElement)[] = [];
let blocks: TextBox[] = [];
let srcBox: TextBox | null = null;
let docMap: { [id: string]: FileInfo };
let edgeMap: { [id: string]: any };
let skipIds = [ 182, 1, 8, 154, 155, 153, -100, -101, -102 ];
let skipIds2 = skipIds.map(x => `${x}`);

let mapDocs : FileInfo[] = [];
let mapDocsTmp : FileInfo[];
let mapEdges: Edge[] = [];
let srcDoc : FileInfo | null = null;
let srcG : SVGElement;

function makeTexTextHtml(text: string){
    let lines : string[] = [];

    for(let line of text.split('\n')){
        let s = line.trim();
        if(s.startsWith('$')){
            lines.push(s);
        }
        else{
            lines.push(`<span>${s}<span><br/>`);
        }
    }

    return lines.join('\n');

}

function makeDiv(text: string, box: TextBox|null){
    var ele = document.createElement("div");
    ele.innerHTML = makeTexTextHtml(text);
    document.body.appendChild(ele);

    if(box instanceof TextBox){
        ele.style.cursor = "pointer";
        ele.addEventListener("click", box.onClickBox);
    }

    dom_list.push(ele);

    return ele;
}

function add_node_rect(svg1: SVGSVGElement, nd: any, block: TextBox|null, edge: EdgeOLD|null){
    var rc = document.createElementNS("http://www.w3.org/2000/svg","rect");
    rc.setAttribute("x", "" + (nd.x - nd.width/2));
    rc.setAttribute("y", "" + (nd.y - nd.height/2));
    rc.setAttribute("width", nd.width);
    rc.setAttribute("height", nd.height);
    rc.setAttribute("fill", "cornsilk");
    if(block != null){

        rc.setAttribute("stroke", "green");
    }
    else{

        rc.setAttribute("stroke", "navy");
    }
    svg1.appendChild(rc);


    return rc;
}


function add_edge(svg1: SVGSVGElement, ed: any){
    var path = document.createElementNS("http://www.w3.org/2000/svg","path");

    var d: string = ""; 

    if(ed.points.length == 2){

        for(let [i, pnt] of ed.points.entries()){
            if(i == 0){
    
                d = `M ${pnt.x},${pnt.y}`;
            }
            else{
    
                d += ` L${pnt.x},${pnt.y}`;
            }
        }
    }
    else{

        for(let [i, pnt] of ed.points.entries()){
            if(i == 0){
    
                d = `M ${pnt.x},${pnt.y} Q`;
            }
            else{
    
                d += ` ${pnt.x},${pnt.y}`;
            }
        }
    }
    path.setAttribute("fill", "transparent");
    path.setAttribute("stroke", "navy");
    path.setAttribute("stroke-width", "3px");
    path.setAttribute("d", d);
    path.style.cursor = "pointer";

    var edge = ed.edge as EdgeOLD;
    edge.paths.push(path);

    path.addEventListener("click", edge.onClickEdge);

    svg1.appendChild(path);
}


export function get_size(div: HTMLDivElement){
    var min_x = Number.MAX_VALUE, min_y = Number.MAX_VALUE;
    var max_x = 0, max_y = 0;
    console.assert(div.children.length == 1);
    let ele = div.children[0];
    var rc = ele.getBoundingClientRect();
    return [rc.width, rc.height];

    // for(let ele of div.children){
    //     if(ele.tagName != "span" && ele.tagName != "mjx-container"){
    //         continue;
    //     }
        // min_x = Math.min(min_x, rc.left);
        // max_x = Math.max(max_x, rc.right);
        // min_y = Math.min(min_y, rc.top);
        // max_y = Math.max(max_y, rc.bottom);
    // }
    // if(min_x == Number.MAX_VALUE){
    //     min_x = 0;
    // }

    // return [max_x - min_x, max_y - min_y]
}

function make_node(g: any, ele: HTMLDivElement, id:string, block: TextBox|null, edge: EdgeOLD|null){
    var width, height;
    [width, height] = get_size(ele);
    ele!.style.width  = (width + 2 * padding) + "px";
    ele!.style.height = (height + 2 * padding) + "px";

    g.setNode(id, { ele: ele, block: block, edge: edge, width: width + 2 * padding, height: height + 2 * padding });   // label: ele.id,  
}

function ontypeset(blocks: TextBox[], svg1: SVGSVGElement){
    // Create a new directed graph 
    var g = new dagre.graphlib.Graph();

    // Set an object for the graph label
    g.setGraph({});

    // Default to assigning a new object as a label for each new edge.
    g.setDefaultEdgeLabel(function() { return {}; });

    for(let blc of blocks){
        make_node(g, blc.ele!, "" + blc.id, blc, null);

        for(let edge of blc.inputs){

            edge.rect = null;
            edge.paths = [];

            if(edge.label == ""){

                g.setEdge(edge.srcId, blc.id, { edge: edge });
            }
            else{

                console.assert(edge.dstId == blc.id);
                var label_id = `${edge.srcId}-${edge.dstId}`
                g.setEdge(edge.srcId, label_id, { edge: edge });
                make_node(g, edge.label_ele!, label_id, null, edge);
                g.setEdge(label_id, edge.dstId, { edge: edge });
            }
        }
    }

    dagre.layout(g);
    
    var max_x = 0, max_y = 0;
    g.nodes().forEach(function(id:string) {
        var nd = g.node(id);
        max_x = Math.max(max_x, nd.x + nd.width / 2);
        max_y = Math.max(max_y, nd.y + nd.height/ 2);
    });

    svg1.style.width  = max_x + "px";
    svg1.style.height = max_y + "px";


    var rc1 = svg1.getBoundingClientRect() as DOMRect;
    g.nodes().forEach(function(id:string) {
        var nd = g.node(id);

        var ele = nd.ele as HTMLDivElement;
    
        ele.style.position = "absolute";
        ele.style.left = `${window.scrollX + rc1.x + nd.x - nd.width /2 + padding}px`
        ele.style.top  = `${window.scrollY + rc1.y + nd.y - nd.height/2 + padding}px`
            
        var rc = add_node_rect(svg1, nd, nd.block, nd.edge);
        if(nd.block != null){

            nd.block.rect = rc;
        }
        else{
            (nd.edge as EdgeOLD).rect = rc;
        }
    });


    g.edges().forEach(function(edge_id:any) {
        var ed = g.edge(edge_id);
        add_edge(svg1, ed);
    });
}

function clear_dom(){
    for(let dom of dom_list){
        dom.parentNode!.removeChild(dom);
    }
    dom_list = [];
}

function showGraph(){
    // checkBlocks();
    clear_dom();

    var svg1 = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg1.style.backgroundColor = "wheat";
    svg1.style.width = "1px";
    svg1.style.height = "1px";
    svg1.addEventListener("click", (ev:MouseEvent)=>{
        if(srcBox != null){
            srcBox.rect!.setAttribute("stroke", "green");
            srcBox = null;
        }
    })

    document.body.appendChild(svg1);

    for(let block of blocks){
        block.make();
    }

    MathJax.typesetPromise()
    .then(function(x, y){
        return ontypeset(x, y);
    }(blocks, svg1))
    .catch((err:any) => msg(err.message));

    dom_list.push(svg1);
}

class Edge {
    srcId!: number;
    dstId!: number;
    label!: string;
}

class EdgeOLD {
    srcId: number;
    dstId: number;
    label: string;

    clicked = false; 
    label_ele: HTMLDivElement | null = null;
    rect: SVGRectElement|null = null;
    paths: SVGPathElement[] = [];

    constructor(src_id: number, dst_id: number, label: string){
        this.srcId = src_id;
        this.dstId = dst_id;
        this.label = label;
    }

    onClickEdge = (ev:MouseEvent)=>{
        ev.stopPropagation();

        if(ev.ctrlKey && ev.shiftKey){

            var dst_blc = get_block(this.dstId)!;
            dst_blc.inputs = dst_blc.inputs.filter(x => x != this);
    
            showGraph();
        }
    }

}

class TextBox {
    id!: number;
    inputs: EdgeOLD[];
    text: string;

    ele: HTMLDivElement | null = null;
    rect: SVGRectElement|null = null;
    
    constructor(inputs: EdgeOLD[], text: string){
        this.inputs = inputs;
        this.text = text;
    }

    /*
        HTML要素を作る。
    */
    make(){
        this.ele = makeDiv(this.text, this);

        for(let edge of this.inputs){
            if(edge.label != ""){
                edge.label_ele = makeDiv(edge.label, null);
            }
        }
    }

    onClickBox = (ev:MouseEvent)=>{
        ev.stopPropagation();

        if(ev.ctrlKey){
            msg("click box");

            if(srcBox == null){

                srcBox = this;
                srcBox.rect!.setAttribute("stroke", "red");
            }
            else{

                srcBox.rect!.setAttribute("stroke", "green");

                this.inputs.push(new EdgeOLD(srcBox.id, this.id, ""));

                srcBox = null;

                showGraph();
            }    
        }
        else if(ev.shiftKey){

            showEditHtml(`${this.id}`);
        }
        else{

            showPlayHtml(`${this.id}`);
        }
    }
}


function get_block(id: number){
    return blocks.find(x => x.id == id);
}

function checkBlocks(){
    for(let [i, blc] of blocks.entries()){
        console.assert(i == blc.id);
        for(let edge of blc.inputs){
            console.assert(0 <= edge.srcId && edge.srcId < blocks.length);
            console.assert(edge.srcId != edge.dstId && edge.dstId == blc.id);
        }
    }
}

function initEdges(edges: any[]){
    for(let edge of edges){
        let dst_id = edge.dstId;
        let box = blocks.find(x => x.id == dst_id);
        if(box instanceof TextBox){

            box.inputs.push(new EdgeOLD(edge.srcId, dst_id, edge.label));
        }
        else{
            console.assert(false);
        }
    }

    showGraph();
}

function setEvent(docs: FileInfo[], edges: Edge[]){
    for(let doc of docs){
        if(skipIds.includes(doc.id) || skipIds2.includes(doc.id as unknown as string )){
            continue;
        }
        let box = getElement(`${doc.id}`);
        box.addEventListener("click", function(ev:MouseEvent){
            if(! Glb.edit){
                return;
            }

            let doc1 = docMap[this.id];
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
                    makeDot(mapDocs, mapEdges, true);

                    srcG.setAttribute("fill", "white");
                    srcDoc = null;
                }
            }
            else{

                window.open(`play.html?id=${doc1.id}`, '_blank');
            }

        });
    }
    
    for(let edge of edges){
        if(skipIds.includes(edge.srcId) || skipIds.includes(edge.dstId)){
            continue;
        }
        let dom = getElement(`${edge.srcId}:${edge.dstId}`);
        if(dom == null){
            console.log(`err edge ${edge.srcId}:${edge.dstId}`);
            continue;
        }
        dom.addEventListener("click", function(ev:MouseEvent){
            let edge = edgeMap[this.id];
            console.log(`click ${edge.srcId} -> ${edge.dstId}`);
        });
    }
}

function makeDot(docs: FileInfo[], edges: Edge[], all_docs: boolean){
    let docLines : string[] = [];
    let edgeLines : string[] = [];

    docMap = {};

    if(all_docs){
        for(let doc of docs){
            docMap[`${doc.id}`] = doc;
            docLines.push(`b${doc.id} [ label="${doc.title}", id="${doc.id}" ];` );
        }
    }

    edgeMap = {};
    for(let edge of edges){
        if(skipIds.includes(edge.srcId) || skipIds.includes(edge.dstId)){
            continue;
        }

        for(let id of [edge.srcId, edge.dstId]){
            if(docMap[`${id}`] == undefined){
                let doc = docs.find(x => x.id == id);
                if(doc == undefined){
                    continue;
                }

                docMap[`${id}`] = doc;
                docLines.push(`b${doc.id} [ label="${doc.title}", id="${doc.id}" ];` );
            }
        }

        let id = `${edge.srcId}:${edge.dstId}`;
        edgeMap[id] = edge;
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
        setEvent(Object.values(docMap), edges);
    })
    .catch((error:any) => {
        // Create a new Viz instance (@see Caveats page for more info)
        viz = new Viz();

        // Possibly display the error
        console.error(error);
    });

}

export function getMap(map_id: number){
    if(Glb.getJsonFile){

        fetchText(`json/${map_id}.json`, (text: string)=>{
            let obj = JSON.parse(text);
            makeDot(indexFile.docs, JSON.parse(obj.text).edges, false);
        });
    }
    else{

        fetchDB(`${map_id}`, (id: string | null, data:any)=>{
            let obj = JSON.parse(data.text);
            makeDot(indexFile.docs, obj.edges, false);
            // initEdges(obj.edges);
        });
    }

}

function saveGraph(){
    let edges = [];

    for(let box of blocks){
        for(let edge of box.inputs){

            edges.push({ srcId: edge.srcId, dstId: edge.dstId, label: edge.label});
        }
    }

    let obj = { edges: edges };
    const text = JSON.stringify(obj, null, 4);

    writeTextFile("edges", text);
}

export function newMap(){
}


export function putMap(){
}

export function delMap(){
}

function setMapSel(){
    if(indexFile.maps.length == 1 || ! Glb.edit){
        getMap(indexFile.maps[0].id);
    }
    if(! Glb.edit){
        return;
    }

    getElement("map-edit").style.display = "block";

    indexFile.docs.sort((x: any, y: any)=>x.title.localeCompare(y.title, 'ja'));
    let tr : HTMLTableRowElement;
    mapTbl.innerHTML = "";

    let ncol = 8;
    let nrow = Math.ceil(indexFile.docs.length / ncol);
    for(let row of range(nrow)){
        tr = document.createElement("tr");
        mapTbl.appendChild(tr);
        for(let col of range(ncol)){
            let idx = col * nrow + row;
            if(indexFile.docs.length <= idx){
                break;
            }

            let doc = indexFile.docs[idx];

            let td = document.createElement("td");
            td.id = `td-${doc.id}`;
            td.addEventListener("click", function(ev: MouseEvent){
                let id = parseInt(this.id.substring(3));
                let doc2 = indexFile.docs.find(x => x.id == id)!;

                if(mapDocsTmp.includes(doc2)){

                    removeArrayElement(mapDocsTmp, doc2);
                    this.style.backgroundColor = "white";
                }
                else{

                    mapDocsTmp.push(doc2);
                    this.style.backgroundColor = "lightgrey";
                }

            });
            td.innerHTML = doc.title;


            tr!.appendChild(td);
    
        }
    }
    
    for(let map of indexFile.maps){
        let opt = document.createElement("option");
        opt.value = `${map.id}`;
        opt.innerHTML = map.title;

        mapSel.appendChild(opt);
    }
}

export function showMapDlg(){
    mapDocsTmp = mapDocs.slice();
    mapDlg.showModal();
}

export function mapDlgOk(){
    mapDlg.close();
    mapDocs = mapDocsTmp;
    makeDot(mapDocs, mapEdges, true);
}

export function initGraph(){
    console.log("body load");

    initBansho(window.location.href.includes("?edit=true"));

    mapSel = getElement("map-sel") as HTMLSelectElement;
    mapTitle = getElement("map-title") as HTMLInputElement;
    mapDiv = getElement("map-div") as HTMLDivElement;

    mapDlg = getElement("map-dlg") as HTMLDialogElement;
    mapTbl = getElement("map-tbl") as HTMLTableElement;

    msg(`init graph edit:${Glb.edit}`);

    let save_btn = document.getElementById("save-graph") as HTMLButtonElement;
    save_btn.addEventListener("click", saveGraph);


    let s0 = `こんにちは。
    $ \\displaystyle \\int_{-\\infty}^\\infty \\frac{df}{dx} dx $<br/>
    $\\int_{-\\infty}^\\infty \\frac{df}{dx} dx $`;

    let s1 = `ピタゴラスの定理
    $ a^2 + b^2 = c^2 $`;

    let s2 = `三角関数の定理
    $ \\cos^2 \\theta + \\sin^2 \\theta = 1 $`;

    for(let [i, s] of [s0, s1, s2].entries()){
        let box = new TextBox([], s);
        box.id = -100 - i;
        blocks.push(box);
    }

    if(Glb.getJsonFile){
        fetchText("json/index.json", (text: string)=>{
            indexFile = JSON.parse(text);
            setMapSel();
        });
    }
    else{

        initFirebase(()=>{
            setMapSel();
        });
    }

    setGraphEventListener();
}

function showHtml(file_name: string, id: string){
    // https://lkzf.info/bansho/list
    let k = window.location.href.lastIndexOf("/");
    let base = window.location.href.substring(0, k);
    let url = `${base}/${file_name}.html?id=${id}`
    window.open(url, '_blank');
}

function showEditHtml(id: string){
    showHtml("edit", id);
}

function showPlayHtml(id: string){
    showHtml("play", id);
}

function initSvgNodes(docs: any){
    for(let doc of docs.files){
        let node = document.getElementById(doc.id) as any as SVGGElement;
        
        node.style.cursor = "pointer";
        node.addEventListener("click", function(ev:MouseEvent){
            showPlayHtml(this.id);
        });
    }
}


export function showGraphviz(){
    let a = new Mat3([[1,3,5], [2,3,7], [3,2,1]]);
    let b = new Mat3([[7,2,5],[4,1,3],[3,7,5]]);
    msg(`det:${a.det()} ${b.det()}`);

    a.mul(2).print("a * 2");
    a.mul(b).print("a * b");
    a.inv().print("a inv");
    a.inv().mul(a).print("a inv a");
    b.inv().mul(b).print("b inv b");

    Glb.svgGraph = document.getElementById("svg-graph") as any as SVGSVGElement;

    fetchText("graph.svg", (text: string)=>{
        let k = text.indexOf("<svg");
        text = text.substring(k);

        Glb.svgGraph.outerHTML = text;

        fetchFileList(initSvgNodes);
    });
}

}
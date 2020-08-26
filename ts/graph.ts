/// <reference path="main.ts" />
namespace bansho{
declare var MathJax:any;
declare var dagre:any;
declare var Viz: any;

const padding = 10;

var dom_list : (HTMLElement | SVGSVGElement)[] = [];
let blocks: TextBox[] = [];
let srcBox: TextBox | null = null;
let docMap: { [id: string]: any };
let edgeMap: { [id: string]: any };

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

function add_node_rect(svg1: SVGSVGElement, nd: any, block: TextBox|null, edge: Edge|null){
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

    var edge = ed.edge as Edge;
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

function make_node(g: any, ele: HTMLDivElement, id:string, block: TextBox|null, edge: Edge|null){
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
            (nd.edge as Edge).rect = rc;
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
    inputs: Edge[];
    text: string;

    ele: HTMLDivElement | null = null;
    rect: SVGRectElement|null = null;
    
    constructor(inputs: Edge[], text: string){
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

                this.inputs.push(new Edge(srcBox.id, this.id, ""));

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

            box.inputs.push(new Edge(edge.srcId, dst_id, edge.label));
        }
        else{
            console.assert(false);
        }
    }

    showGraph();
}

function setEvent(index: any, map: any){
    for(let doc of index.doc){
        let box = getElement(`${doc.id}`);
        box.addEventListener("click", function(ev:MouseEvent){
            let doc1 = docMap[this.id];
            console.log(`click ${doc1.id} ${doc1.title}`);
        });
    }
    
    for(let edge of map.edges){
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

function makeDot(index: any, map: any){
    let lines : string[] = [];

    docMap = {};
    for(let doc of index.doc){
        docMap["" + doc.id] = doc;
        lines.push(`b${doc.id} [ label="${doc.title}", id="${doc.id}" ];` );
    }

    edgeMap = {};
    for(let edge of map.edges){
        let id = `${edge.srcId}:${edge.dstId}`;
        edgeMap[id] = edge;
        lines.push(`b${edge.srcId} -> b${edge.dstId} [ id="${id}" ];`);
    }

    let dot = `
    digraph graph_name {
        graph [
          charset = "UTF-8";
          label = "数学・物理・AIの依存関係",
        ];
        ${lines.join('\n')}
    }
    `;

    var viz = new Viz();

    // dot = 'digraph { a -> b }';
    viz.renderSVGElement(dot)
    .then(function(element: any) {
        document.body.appendChild(element);
        setEvent(index, map);
    })
    .catch((error:any) => {
        // Create a new Viz instance (@see Caveats page for more info)
        viz = new Viz();

        // Possibly display the error
        console.error(error);
    });

}

function getFileList(docs: any){
    // for(let doc of docs.doc){
    //     let box = new TextBox([], doc.title);
    //     box.id = parseInt(doc.id);
    //     blocks.push(box);
    // }

    fetchDB(`${docs.map[0].id}`, (data:any)=>{
        let obj = JSON.parse(data.text);
        makeDot(docs, obj);
        // initEdges(obj.edges);
    });

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

export function initGraph(){
    Glb.edit = (window.location.href.includes("?edit=true"));
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

    initFirebase(()=>{
        fetchDB("index", getFileList);
    });
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
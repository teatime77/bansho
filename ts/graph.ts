/// <reference path="main.ts" />
namespace MathMemo{
declare var MathJax:any;
declare var dagre:any;

export var dom_list : (HTMLElement | SVGSVGElement)[] = [];

function add_node_rect(svg1: SVGSVGElement, nd: any, block: TextBlock|null, edge: Edge|null){
    var rc = document.createElementNS("http://www.w3.org/2000/svg","rect");
    rc.setAttribute("x", "" + (nd.x - nd.width/2));
    rc.setAttribute("y", "" + (nd.y - nd.height/2));
    rc.setAttribute("width", nd.width);
    rc.setAttribute("height", nd.height);
    rc.setAttribute("fill", "cornsilk");
    if(block != null){

        if(block.link == null){

            rc.setAttribute("stroke", "green");
        }
        else{
    
            rc.setAttribute("stroke", "blue");
        }
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

    var edge = ed.edge as Edge;
    edge.paths.push(path);

    path.addEventListener("click", edge.onclick_edge);

    svg1.appendChild(path);
}    

function make_node(g: any, ele: HTMLDivElement, id:string, block: TextBlock|null, edge: Edge|null){
    var width, height;
    [width, height] = get_size(ele);
    ele!.style.width  = (width + 2 * padding) + "px";
    ele!.style.height = (height + 2 * padding) + "px";

    g.setNode(id, { ele: ele, block: block, edge: edge, width: width + 2 * padding, height: height + 2 * padding });   // label: ele.id,  
}

function ontypeset(id_blocks: OrderedMap<string, TextBlock>, svg1: SVGSVGElement){
    // Create a new directed graph 
    var g = new dagre.graphlib.Graph();

    // Set an object for the graph label
    g.setGraph({});

    // Default to assigning a new object as a label for each new edge.
    g.setDefaultEdgeLabel(function() { return {}; });

    for(let blc of id_blocks.values()){
        make_node(g, blc.ele!, "" + blc.id, blc, null);

        for(let edge of blc.inputs){

            edge.rect = null;
            edge.paths = [];

            if(edge.label == ""){

                g.setEdge(edge.src_id, blc.id, { edge: edge });
            }
            else{

                console.assert(edge.dst_id == blc.id);
                var label_id = `${edge.src_id}-${edge.dst_id}`
                g.setEdge(edge.src_id, label_id, { edge: edge });
                make_node(g, edge.label_ele!, label_id, null, edge);
                g.setEdge(label_id, edge.dst_id, { edge: edge });
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

    logic_graph.pending = false;
}

function clear_dom(){
    for(let dom of dom_list){
        dom.parentNode!.removeChild(dom);
    }
    dom_list = [];
}

export function show_doc(doc: Doc){
    doc.check();
    clear_dom();

    doc_title_text.value = cur_doc.title;

    var svg1 = document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg1.style.backgroundColor = "wheat";
    svg1.style.width = "1px";
    svg1.style.height = "1px";
    svg1.addEventListener("click", function(){
        console.log("SVG clicked " + (click_cnt++));
    })
    document.body.appendChild(svg1);

    var id_blocks = new OrderedMap();

    for(let block of doc.blocks){

        id_blocks.set(block.id, block);

        block.make();
    }

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([ontypeset, id_blocks, svg1]);

    dom_list.push(svg1);
}

}
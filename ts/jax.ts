namespace tekesan {

declare let MathJax:any;

export const IDX = 0;
export const NODE_NAME = 1;

class ElementJax {
    root : JaxNode|null = null;
    Rerender(){}
}

class JaxNode {
    CHTMLnodeID: number|null = null;
    nodeName: string|null = null;
    parent: JaxNode|null = null;
    childNodes: JaxNode[]|null = null;
}

function getActionId(id: string) : number {
    console.assert(id.startsWith(idPrefix));
    return parseInt(id.substring(idPrefix.length));
}

export function getJaxFromPath(jaxes:JaxNode[], path:[number, string][] | null) : JaxNode {
    let node = jaxes[path![0][IDX]];
    console.assert(node.nodeName == path![0][NODE_NAME])

    for(let obj of path!.slice(1)){
        node = node.childNodes![obj[IDX]];
        console.assert(node.nodeName == obj[NODE_NAME])
    }

    return node;
}

export function getJaxIndex(node: JaxNode){
    return node.parent!.childNodes!.indexOf(node);
}

export function getDomFromJax(node: JaxNode) : HTMLElement{
    return document.getElementById(`MJXc-Node-${node.CHTMLnodeID}`)!;
}

function getDomAncestors(node: Node) : HTMLElement[] {
    function* fnc(node: Node){
        for(let nd = node.parentElement; nd != null; nd = nd.parentElement){
            yield nd;
        }
    }

    return Array.from(fnc(node));
}

export function reprocessMathJax(ui: UI, html: string){

    if(!ui.suppressMathJax && html.includes("$")){
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    }
}

function getJaxPath(jaxIdx: number, jaxList:JaxNode[], maxNest: number) : any[]{
    const path : [number, string][] = [];

    let parent = jaxList[0];

    path.push([jaxIdx, parent.nodeName!]);

    for(let nest = 1; nest <= maxNest; nest++){
        let jax = jaxList[nest];
        let idx = parent.childNodes!.indexOf(jax);
        console.assert(idx != -1);
        path.push([ idx, jax.nodeName!]);
        parent = jax;
    }

    return path;
}

export function getJaxesInBlock(div: HTMLDivElement) : JaxNode[]{
    const allJaxes = (MathJax.Hub.getAllJax() as ElementJax[]).map(x => x.root!);

    const allDoms = allJaxes.map(x => getDomFromJax(x));

    const domsInSpan = allDoms.filter(x => getDomAncestors(x).includes(div) );

    const jaxesInSpan = domsInSpan.map(x => allJaxes[allDoms.indexOf(x)]);

    return jaxesInSpan;
}

function* getJaxDescendants(node:JaxNode) : IterableIterator<JaxNode> {
    if(node != null && node.nodeName != undefined && node.CHTMLnodeID != undefined){

        yield node;

        if(! ["mi", "mn", "mo"].includes(node.nodeName)){

            if(node.childNodes != undefined){
                for(let nd of node.childNodes){
                    yield* getJaxDescendants(nd);
                }
            }
        }
    }
}

function findSelectedDoms(ui: UIEdit, div: HTMLDivElement, ev:MouseEvent) : boolean{
    const selActs = ui.actions.filter(x => x instanceof SelectionAction) as SelectionAction[];

    for(let ele = ev.srcElement as HTMLElement; ; ele = ele.parentElement!){
        if(ele == ui.board || !(ele instanceof HTMLElement)){

            return false;
        }

        let sels = selActs.filter(x => x.setSelectedDoms().includes(ele) );
        if(sels.length != 0){
            msg("選択無効");
            
            const hideAct = new DisableAction(ui, sels[0].id);
            ui.addAction(hideAct);
            return true;
        }
    }
}

function makeDomJaxMap(jaxes: JaxNode[]) : [Map<HTMLElement, JaxNode>, Map<JaxNode, HTMLElement>]{
    const dom2jax = new Map<HTMLElement, JaxNode>();
    const jax2dom = new Map<JaxNode, HTMLElement>();
    for(let ej of jaxes){
        for(let node of getJaxDescendants(ej)){

            let ele = getDomFromJax(node);
            dom2jax.set(ele, node);
            jax2dom.set(node, ele);
        }
    }

    return [dom2jax, jax2dom];
}

export function onClickBlock(act:TextBlockAction, ev:MouseEvent){
    msg("clicked");

    ev.stopPropagation();

    const found = findSelectedDoms(act.ui as UIEdit, act.div, ev);
    if(found){
        return;
    }

    let mjxMath = null;
    for(let ele = ev.srcElement as HTMLElement;; ele = ele.parentNode as HTMLElement){

        if(ele.tagName != "SPAN"){
            break;
        }
        if(ele.className == "mjx-math"){
            mjxMath = ele;
            break;
        }
    }
    if(mjxMath == null){
        return;
    }

    const jaxes = getJaxesInBlock(act.div);
    const [dom2jax, jax2dom] = makeDomJaxMap(jaxes);

    function checkPath(text: string, path:any[], node2: JaxNode){
        msg(`${text}: ${path.map(x => `${x[IDX]}:${x[NODE_NAME]}`).join(',')}`);
        const node = getJaxFromPath(jaxes, path);
        console.assert(node == node2);
    }

    const sel = window.getSelection()!;
    
    if(sel.rangeCount == 1){

        let selAct : SelectionAction | null = null;

        const rng = sel.getRangeAt(0);

        msg(`start:${rng.startContainer.textContent} end:${rng.endContainer.textContent}`);

        const stAncs = getDomAncestors(rng.startContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)!).reverse();
        let jaxIdx;
        for(jaxIdx = 0; jaxIdx < jaxes.length; jaxIdx++){
            if(jaxes[jaxIdx] == stAncs[0]){
                break;
            }
        }

        msg(`all jax: ${jaxIdx}`);

        if(rng.startContainer == rng.endContainer){

            if(stAncs.length != 0){

                const startPath = getJaxPath(jaxIdx, stAncs, stAncs.length - 1);
                checkPath("path", startPath, last(stAncs));

                selAct = new SelectionAction(act.ui, getActionId(act.div.id), "math", startPath, null, selectColor);
            }
        }
        else{

            const edAncs = getDomAncestors(rng.endContainer).filter(x => dom2jax.has(x)).map(x => dom2jax.get(x)!).reverse();

            for(let nest = 0; nest < Math.min(stAncs.length, edAncs.length); nest++){
                if(stAncs[nest] != edAncs[nest]){

                    console.assert(nest != 0);

                    let parentJax = stAncs[nest - 1];

                    if(parentJax.nodeName == "msubsup"){

                        let startPath = getJaxPath(jaxIdx, stAncs, nest - 1);
                        checkPath("path", startPath, parentJax);

                        selAct = new SelectionAction(act.ui, getActionId(act.div.id), "math", startPath, null, selectColor);
                    }
                    else{

                        let startPath = getJaxPath(jaxIdx, stAncs, nest);
                        let endPath   = getJaxPath(jaxIdx, edAncs, nest);

                        checkPath("path1", startPath, stAncs[nest]);
                        checkPath("path2", endPath  , edAncs[nest]);

                        selAct = new SelectionAction(act.ui, getActionId(act.div.id), "math", startPath, endPath, selectColor);
                    }
                    break;
                }
            }
        }

        if(selAct != null){
            selAct.enable();

            (act.ui as UIEdit).addAction(selAct);
        }
    }

    window.getSelection()!.removeAllRanges();
}

}
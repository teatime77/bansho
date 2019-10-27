namespace tekesan {
declare let MathJax:any;
export const padding = 10;
const endMark = "😀";
export let actionMap : Map<number, Action>;
let pendingRefs : any[];
let stopPlaying: boolean = false;
let classes : any[];
export let divMsg : HTMLDivElement = null;
export let focusedActionIdx : number;
export let divActions : HTMLDivElement;
export let textMath : HTMLTextAreaElement;

export function msg(text: string){
    console.log(text);

    if(divMsg != null){

        divMsg.textContent = divMsg.textContent + "\n" + text;
        divMsg.scrollTop = divMsg.scrollHeight;
    }
}

export function range(n: number) : number[]{
    return [...Array(n).keys()];
}

function ltrim(stringToTrim) {
	return stringToTrim.replace(/^\s+/,"");
}

export function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
}

export function arrayLast<T>(arr:T[]) : T{
    console.assert(arr.length != 0);
    return arr[arr.length - 1];
}

export function arrayRemove<T>(arr:T[], x:T) {
    const index = arr.indexOf(x);
    if (index != -1) {
        arr.splice(index, 1);
    }
}

function getIndent(line: string) : [number, string]{
    let indent = 0;
    while(true){
        if(line.startsWith("\t")){
            indent++;
            line = line.substring(1);    
        }
        else if(line.startsWith("    ")){
            indent++;
            line = line.substring(4);
        }
        else{
            return [indent, line];
        }
    }
}

function tab(indent: number){
    return " ".repeat(4 * indent);
}

export function makeHtmlLines(text: string){
    const lines = text.split('\n');
    const htmlLines = [];            

    let inMath = false;
    let ulIndent = -1;
    let prevLine = "";
    for(let currentLine of lines){
        let currentLineTrim = currentLine.trim();

        let [indent, line] = getIndent(currentLine);
        indent--;

        if(currentLineTrim == "$$"){
            inMath = ! inMath;
            htmlLines.push(currentLine);
        }
        else{
            if(inMath){

                htmlLines.push(currentLine);
            }
            else{

                if(line.startsWith("# ")){
                    htmlLines.push(tab(indent + 1) + "<strong><span>" + line.substring(2) + "</span></strong><br/>")
                }
                else if(line.startsWith("- ")){
                    if(ulIndent < indent){
                        console.assert(ulIndent + 1 == indent);
                        htmlLines.push(tab(indent) + "<ul>")
                        ulIndent++;
                    }
                    else{
                        while(ulIndent > indent){
                            htmlLines.push(tab(ulIndent) + "</ul>")
                            ulIndent--;
                        }                            
                    }
                    htmlLines.push(tab(indent + 1) + "<li><span>" + line.substring(2) + "</span></li>")
                }
                else{

                    if(prevLine.endsWith("</li>")){
                        htmlLines[htmlLines.length - 1] = prevLine.substring(0, prevLine.length - 5) + "<br/>";
                        htmlLines.push(tab(indent + 1) + "<span>" + line + "</span></li>")
                    }
                    else{

                        htmlLines.push(tab(indent + 1) + "<span>" + line + "</span><br/>")
                    }
                }
            }
        }

        prevLine = htmlLines[htmlLines.length - 1];
    }

    while(ulIndent != -1){
        htmlLines.push(tab(ulIndent) + "</ul>")
        ulIndent--;
    }

    return htmlLines.join("\n");
}

export function tostr(text: string){
    if(! text.includes('\n')){
        return JSON.stringify(text);
    }
    else{
        return `${endMark}${text}${endMark}`;
    }
}

function objToStr(obj: any, nest: number){
    const t1 = " ".repeat(4 * nest);
    const t2 = " ".repeat(4 * (nest + 1));

    if(Array.isArray(obj)){
        return `${t1}[\n` + (obj as any[]).map(x => objToStr(x, nest + 1)).join(`,\n`) + `\n${t1}]`;
    }

    if(typeof obj == "object"){

        if(obj.ref != undefined){
            
            return `${t1}{ "ref": ${obj.ref} }`;
        }



        if(obj.typeName == "TextBox"){
            msg(``);
        }

        let lines = [];
        for (let [key, value] of Object.entries(obj)){
            lines.push(`${t2}"${key}": ${ltrim(objToStr(value, nest + 1))}`)
        }
        
        return `${t1}{\n` + lines.join(`,\n`) + `\n${t1}}`;
    }

    if(typeof obj == "string"){
        if(obj.includes('\n')){
            return `${endMark}${obj}${endMark}`;
        }
    }

    return JSON.stringify(obj);
}


export function fromObj(parent:any, key:any, obj: any){
    if(Array.isArray(obj)){

        let v = [];
        for(let [i, x] of (obj as any[]).entries()){
            v.push( fromObj(v, i, x) );
        }

        return v;
    }

    if(typeof obj == "object"){

        let act;

        if(obj.ref != undefined){
            
            if(actionMap.has(obj.ref)){
                return actionMap.get(obj.ref);
            }
            else{
                
                pendingRefs.push({ parent:parent, key:key, ref: obj.ref });
                return obj;
            }
        }

        if(classes == undefined){
            classes = Object.entries(tekesan).map(([key, val]) => val as any ).filter(x => x.name != undefined && x.prototype != undefined && x.prototype.constructor != undefined);
        }
        const cls = classes.find(x => x.name == obj["typeName"]);
        console.assert(cls != undefined);

        act = new (cls as any).prototype.constructor();
        act.make(obj);


    
        for (let [key, value] of Object.entries(obj)){
            act[key] = fromObj(obj, key, value);
        }

        console.assert(!actionMap.has(act.id));
        actionMap.set(act.id, act);

        return act;
    }

    return obj;
}

export function serializeActions() : string {
    for(let [i,x] of allActions.entries()){
        x.id = i;
    }
    actionMap = new Map<number, Action>();

    const actionObjs = actions.map(x => x.toObj());

    return objToStr(actionObjs, 0);
}

export function reviseJson(text:string){
    let ret = "";

    const el = endMark.length;
    while(true){
        let k1 = text.indexOf(endMark);
        if(k1 == -1){
            return ret + text;
        }

        let k2 = text.indexOf(endMark, k1 + el);
        console.assert(k2 != -1);

        ret += text.substring(0, k1) + JSON.stringify(text.substring(k1 + el, k2));
        text = text.substring(k2 + el);
    }
}

export function deserializeActions(text: string){
    const obj = JSON.parse(reviseJson(text));

    actionMap = new Map<number, Action>();
    pendingRefs = [];
    actions = fromObj(null,null, obj);

    for(let pending of pendingRefs){
        console.assert(actionMap.has(pending.ref));

        let act = actionMap.get(pending.ref);
        pending.parent[pending.key] = act;
    }
}


function* waitActions(){
    let typesetDone = false;
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([function(){
        typesetDone = true;
    }]);

    while(! typesetDone){
        yield;
    }

    divMath.scrollTop = divMath.scrollHeight;
}

export function runGenerator(gen: IterableIterator<any>){
    stopPlaying = false;

    const id = setInterval(function(){
        const ret = gen.next();
        if(ret.done || stopPlaying){        

            clearInterval(id);
            msg("停止しました。");
        }
    },100);
}

export function openActionData(actionText: string){
    deserializeActions(actionText);

    if(actions.length == 0){
        ActionId = 0;
        actions.push(new TextBlockAction().make({text:""}));
    }

    ActionId = Math.max(... actions.map(x => x.id)) + 1;
    focusedActionIdx = 0;

    function* fnc(){
        for(let act of actions){
            act.init();
            yield* act.restore();
            divActions.appendChild(act.summaryDom());
        }

        yield* waitActions(); 

        for(let act of actions.filter(x => x.constructor.name == "SelectionAction")){
            (act as SelectionAction).setSelectedDoms();
        }
    }

    runGenerator(fnc());
}

}

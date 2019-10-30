namespace tekesan {
declare let MathJax:any;
export const padding = 10;
const endMark = "😀";
let stopPlaying: boolean = false;
let divMsg : HTMLDivElement = null;
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

export function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
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

export function serializeDoc() : string {
    return `{
  "title": "${title}",
  "actions": [
${actions.filter(x => !(x instanceof EmptyAction)) .map(x => "    " + x.toStr()).join(",\n")}
  ]
}`
}

export function deserializeDoc(text: string){
    ActionId = 0;
    selActions.innerHTML = "";

    const doc = JSON.parse(reviseJson(text));

    actions = [];
    for(let [id, obj] of doc.actions.entries()){
        let act: Action;

        switch(obj.type){
        case "text":
            act = new TextBlockAction((obj as TextBlockAction).text);
            break;
        
        case "speech":
            act = new SpeechAction((obj as SpeechAction).text);
            break;

        case "select":
            act = SelectionAction.fromObj(obj as SelectionAction);
            break;

        default:
            console.assert(false);
            break;
        }
        console.assert(act.id == id && id + 1 == ActionId);

        actions.push(act);

        let opt = document.createElement("option");
        opt.textContent = act.summary();
        selActions.options.add(opt);
    }
    selActions.selectedIndex = selActions.options.length - 1;

    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
    MathJax.Hub.Queue([function(){
        for(let act of actions){
            act.enable();
        }
    }]);


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

function renumId(){
    for(let [id, act] of actions.entries()){
        if(act instanceof TextBlockAction){
            act.div.id = getBlockId(id);
        }
        else if(act instanceof SelectionAction){
            const block = actions.find(x => x.id == (act as SelectionAction).blockId);
            console.assert(block != undefined);

            act.blockId = actions.indexOf(block);
            console.assert(act.blockId != -1);
        }
    }

    for(let [id, act] of actions.entries()){
        act.id = id;
    }

    ActionId = actions.length;
}

export function backup(){
    renumId();
    const text = serializeDoc();
    msg(`[${text}]`);

    navigator.clipboard.writeText(text).then(function() {
        msg("copy OK");
    }, function() {
        msg("copy NG");
    });

    return;


    var url = `${window.location.origin}/`;
    var data = {username: 'example'};
    
    fetch(url, {
        method: "POST", // or 'PUT'
        body: JSON.stringify(text),
        headers:{
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(response => {
        console.log('Success:', JSON.stringify(response))
    })
    .catch(error => {
        console.error('Error:', error)
    });
}

export function fetchText(path:string, fnc:(text: string)=>void){
    let url: string;

    if(path.startsWith("http")){

        url = path;
    }
    else{

        let k = window.location.href.lastIndexOf("/");

        url = `${window.location.href.substring(0, k)}/${path}`;
    }
    const url2 = encodeURI(url);
    msg(`fetch-json:${url} ${url2}`);
    fetch(url2)
    .then((res: Response) => {
        return res.text();
    })
    .then(text => {
        fnc(text);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

export function openDoc(){
    fetchText("json/1.json", (text: string)=>{
        msg(`[${text}]`);
        deserializeDoc(text);
    });
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
    deserializeDoc(actionText);

    if(actions.length == 0){
        ActionId = 0;
        actions.push(new TextBlockAction(""));
    }

    ActionId = Math.max(... actions.map(x => x.id)) + 1;

    function* fnc(){
        for(let act of actions){
            act.init();
            yield* act.restore();
        }

        yield* waitActions(); 

        for(let act of actions.filter(x => x.constructor.name == "SelectionAction")){
            (act as SelectionAction).setSelectedDoms();
        }
    }

    runGenerator(fnc());
}

}

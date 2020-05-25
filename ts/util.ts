// import { textMsg } from "./main";

// namespace bansho {
export const padding = 10;
const endMark = "⛩";
let stopPlaying: boolean = false;
export let textMsg : HTMLDivElement;

export function msg(text: string){
    console.log(text);

    if(window.location.search.includes("debug=1")){

        // <textarea id="txt-msg" rows="15" style="display: none; width: 100%; overflow-x: visible; white-space: pre; font-size: large; font-weight: bold; " spellcheck="false" ></textarea>
    }

    // if(textMsg == undefined){

    //     textMsg      = document.getElementById("txt-msg") as HTMLDivElement;
    //     textMsg.style.display = "inline-block";
    // }
    // textMsg.textContent = textMsg.textContent + "\n" + text;
    // textMsg.scrollTop = textMsg.scrollHeight;
}

export function range(n: number) : number[]{
    return [...Array(n).keys()];
}

export function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
}

export const idPrefix = "bansho-id-";

export let colors : string[] = [ "magenta", "blue", "limegreen" ];

export function getBlockId(refId: number) : string {
    return `${idPrefix}${refId}`;
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

export function runGenerator(gen: IterableIterator<any>){
    stopPlaying = false;

    const id = setInterval(function(){
        const ret = gen.next();
        if(ret.done || stopPlaying){        

            clearInterval(id);
            msg("停止しました。");
        }
    },10);
}


// }

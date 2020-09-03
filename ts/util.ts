namespace bansho {

export const padding = 10;
export let textMsg : HTMLDivElement;

export function msg(text: string){
    console.log(text);
}

export function range(n: number) : number[]{
    return [...Array(n).keys()];
}

export function last<T>(v:Array<T>) : T{
    console.assert(v.length != 0);

    return v[v.length - 1];
}

export function removeArrayElement<T>(arr:Array<T>, x: T){
    let idx = arr.indexOf(x);
    console.assert(idx != -1);
    arr.splice(idx, 1);
}

export function getElement(id: string){
    return document.getElementById(id)!;
}

export function removeHtmlElement(ele: Element){
    ele.parentElement!.removeChild(ele);
}

export const idPrefix = "bansho-id-";

export function getBlockId(act: Widget) : string {
    return `${idPrefix}${act.id}`;
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
            if(inMath){

                // !!!!!!!!!! \tag{} の正しい表示ためにdivは必要 !!!!!!!!!!
                htmlLines.push('<div style="display: inline-block">');
                htmlLines.push('$$');
            }
            else{
                htmlLines.push('$$');
                htmlLines.push('</div>');
            }
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
        if(res.status == 404){

            throw new Error("ファイルがありません。");
        }
        else{

            return res.text();
        }
    })
    .then(text => {
        fnc(text);
    })
    .catch(error => {
        msg(`fetch error ${error}`);
    });
}

export function writeTextFile(path: string, text: string){
    msg(`[${text}]`);

    var url = `${window.location.origin}/`;
    var data = {
        "path": path,
        "text": text,
    };
    
    fetch(url, {
        method: "POST", // or 'PUT'
        body: JSON.stringify(data),
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

export function msgBox(text: string, fnc:()=>void){
    getElement("msg-box-text").innerText = text;
    glb.msgBoxCB = fnc;

    glb.msgBoxDlg.showModal();
}
}

namespace bansho {

export const padding = 10;
export let textMsg : HTMLDivElement;

export let mnistImage : Float32Array;
export let mnistLabel : Float32Array;

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
    fetch(url2, { cache : "no-store" })
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
    Glb.msgBoxCB = fnc;

    Glb.msgBoxDlg.showModal();
}

function BytesToInt(data : Uint8Array, offset : number) {
    return data[offset] * 0x1000000 + data[offset + 1] * 0x10000 + data[offset + 2] * 0x100 + data[offset + 3];
}

function getMnistImage(data: Uint8Array){
    let type = BytesToInt(data, 0);

    // データ数
    let cnt  = BytesToInt(data, 4);

    // 画像の高さ
    let h    = BytesToInt(data, 8);

    // 画像の幅
    let w    = BytesToInt(data, 12);

    console.assert(16 + cnt * h * w == data.length);
    mnistImage = new Float32Array(data.slice(16, 16 + 100 * w * h)).map(x => x / 255.0);
    console.log(`MNIST image cnt:${cnt} w:${w} h:${h}`)
}

function getMnistLabel(data: Uint8Array){
    let type = BytesToInt(data, 0);

    // データ数
    let cnt  = BytesToInt(data, 4);

    console.assert(8 + cnt == data.length);
    mnistLabel = new Float32Array(data.slice(8, 8 + 100));
    console.log(`MNIST label cnt:${cnt}`)
}

function fetchBin(url: string, fnc:(data:Uint8Array)=>void){
    fetch(url)
    .then((res: Response) => {
        if(res.status == 404){

            throw new Error("ファイルがありません。");
        }
        else{

            return res.arrayBuffer();
        }
    })
    .then(data => {
        fnc(new Uint8Array(data));
    })
    .catch(error => {
        msg(`fetch error ${error}`);
    });

}

export function getMNIST(){
    fetchBin("mnist/t10k-images.idx3-ubyte", getMnistImage);
    fetchBin("mnist/t10k-labels.idx1-ubyte", getMnistLabel);
}

}

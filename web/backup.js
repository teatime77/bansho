console.log(__dirname);
const fs = require('fs');

let text = fs.readFileSync(`backup.json`, 'utf8');
let files  = JSON.parse(text);


let docs = [];

for(let file of files){
    console.assert(file.id != undefined && file.doc != undefined);

    if(file.doc.text != undefined){

        let doc = JSON.parse(file.doc.text);
        if(doc.widgets != undefined && doc.widgets.length != 0){
            doc.id = file.id;
            docs.push(doc);
        }
    }

    try {
        fs.writeFileSync(`json/${file.id}.json`, JSON.stringify(file.doc, null, 4));
        console.log(`${file.id}`);
    } catch(err) {
        console.assert(false);
    }
}

let texts = [];
let line  = "//" + "-".repeat(80);

docs.sort((x, y)=>x.title.localeCompare(y.title, 'ja'));

for(let doc of docs){
    texts.push(`\n\n${line}\n// ${doc.title}\n${line}`);

    texts.push("\n/*")
    texts.push(... doc.widgets.filter(x => x.typeName == "Speech").map(x => x.Text));
    texts.push("*/")

    for(let sim of doc.widgets.filter(x => x.typeName == "Simulation")){
        if(sim.packageInfos == undefined){

            console.log(`package ERR ${doc.id} ${doc.title}`);
            continue;
        }
        for(let info of sim.packageInfos){
            texts.push(`\n${line}`);
            texts.push(`// display : ${info.display}`);
            texts.push(...info.vertexShader.trim().split('\n'));
        }
    }
}

try {
    fs.writeFileSync(`../work/memo/summary.vert`, texts.join('\n'));
    console.log("要約 ../work/memo/summary.vert");
} catch(err) {
    console.assert(false);
}



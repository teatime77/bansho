console.log(__dirname);
const fs = require('fs');

let text = fs.readFileSync(`backup.json`, 'utf8');
let files  = JSON.parse(text);

for(let file of files){
    console.assert(file.id != undefined && file.doc != undefined);
    try {
        fs.writeFileSync(`json/${file.id}.json`, JSON.stringify(file.doc, null, 4));
        console.log(`${file.id}`);
    } catch(err) {
        console.assert(false);
    }
}



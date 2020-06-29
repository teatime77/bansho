var http = require('http');
const fs = require('fs');
var server = http.createServer(function(req, res) {
    console.log(`${req.method} [${req.url}]`);

    if(req.method == "GET"){

        if(req.url == "/list"){
            
            let docs = getDocList();
            let text = JSON.stringify(docs, null, 4);

            res.writeHead(200, {"Content-Type": "application/json"});
            res.end(text);

            writeText(`list.json`, text);

            makeDot();
        }
        else if(req.url.startsWith("/")){
            let path = req.url.substring(1);
            let k = path.indexOf("?");
            if(k != -1){
                path = path.substring(0, k);
            }

            if(path.endsWith(".ico")){

                console.log("アイコン");
            }
            else if(path.endsWith(".png")){

                if(check(path)) {
                    data = fs.readFileSync(path);

                    res.writeHead(200, {"Content-Type": "image/png"});
                    res.write(data);

                    console.log(`png:[${path}]`);
                }
                else{

                    res.statusCode = 404;
                }
            }
            else{

                if(check(path)){

                    let s = fs.readFileSync(path, 'utf8');
                    res.write(s);
                }
                else{

                    res.statusCode = 404;
                }
            }

            res.end();
        }
        else{

            res.write("Hello world!\n");
            res.end();
        }
    }
    else{
        var body = '';
        // data受信イベントの発生時に断片データ(chunk)を取得
        // body 変数に連結
        req.on('data', function(chunk) {
            body += chunk;
        });
        
        // 受信完了(end)イベント発生時
        req.on('end', function() {

            let data = JSON.parse(body);
            let id = data.path;

            let doc = JSON.parse(data.text);
            let title = (doc.title != undefined ? doc.title : "");
            if(id == ""){

                id = emptyId();
                console.log(`新規 ${id} ${title}`);
            }
            else{

                backup(id);
                console.log(`更新 ${id} ${title}`);
            }

            writeText(`json/${id}.json`, data.text);

            res.write(JSON.stringify({ "status": "ok"}));
            res.end();

            if(id == "edges"){
                makeDot();
            }
        });
    }

}).listen(8080);

function check(filePath) {
    var isExist = false;
    try {
        fs.statSync(filePath);
        isExist = true;
    }
    catch(err) {
        isExist = false;
    }
    return isExist;
}

function writeText(filePath, stream) {
    var result = false;
    try {
        fs.writeFileSync(filePath, stream);
        return true;
    } catch(err) {
        return false;
    }
}

function emptyId(){
    for(let i = 1; ; i++){
        if(! check( `json/${i}.json` )){
            return i;
        }
    }
}

function backup(name){
    let path1 = `json/${name}.json`;
    if(! check(path1)){
        return;
    }

    for(let i = 1; ; i++){
        let path2 = `../work/save/${name}-${i}.json`;
        if(! check(path2)){
            fs.renameSync(path1, path2);
            return;
        }
    }
}

function getDocList(){
    let files = fs.readdirSync('json');

    files = files.filter(x => x.endsWith(".json")).map(x => x.replace(".json", ""));

    let name_titles = [];
    let edges;

    for(let name of files){
        let text = fs.readFileSync(`json/${name}.json`, 'utf8');
        let obj  = JSON.parse(text);

        if(name == "edges"){

            edges = obj.edges;
        }
        else{

            let title = obj.title;

            name_titles.push( { id: name, title: title })
        }
    }
    
    return { files: name_titles, edges: edges };
}

function makeDot(){
    let head = `digraph graph_name {
        graph [
          charset = "UTF-8";
          label = "数学・物理・AIの依存関係",
        ];
    `;

    let docs = getDocList();

    let lines = [];
    for(let doc of docs.files){
        lines.push(`b${doc.id} [ label="${doc.title}", id="${doc.id}" ];`);
    }

    for(let edge of docs.edges){
        lines.push(`b${edge.srcId} -> b${edge.dstId};`)
    }

    let text = head + lines.join('\n') + "\n}";
    writeText(`graph.dot`, text);






}
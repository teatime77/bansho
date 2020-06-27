var http = require('http');
const fs = require('fs');
var server = http.createServer(function(req, res) {
    console.log(`url    [${req.url}]`);
    console.log(`method [${req.method}]`);

    if(req.method == "GET"){

        if(req.url == "/list"){
            fs.readdir('json', function(err, files){
                if (err) throw err;
                console.log(files);

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
                
                res.writeHead(200, {"Content-Type": "application/json"});

                let text = JSON.stringify({ files: name_titles, edges: edges }, null, 4);
                res.end(text);

                writeText(`list.json`, text);
            });
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
            console.log(body);

            let data = JSON.parse(body);
            let id = data.path;

            if(id == ""){

                id = emptyId();
            }
            else{

                backup(id);
            }

            writeText(`json/${id}.json`, data.text);

            res.write(JSON.stringify({ "status": "ok"}));
            res.end();
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
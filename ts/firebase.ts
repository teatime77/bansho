namespace bansho {
// declare let firebase: any;
declare let navigator : any;

export let dropZone : HTMLDivElement;

let inEditor : boolean = false;

// https://github.com/firebase/firebase-js-sdk をクローン
// firebase-js-sdk/packages/firebase/index.d.ts を firebase.d.tsにリネームする。
let db: firebase.firestore.Firestore;

const defaultUid = "Rb6xnDguG5Z9Jij6XLIPHV4oNge2";
let loginUid : string | null = null;
let guestUid = defaultUid;

let indexFile: IndexFile;

class Doc {
    ctime  : number = 0;
    mtime  : number = 0;
    text   : string = "";
}

class TextFile {
    text   : string;

    constructor(text: string){
        this.text = text;
    }
}

class FileInfo {
    id   : number;
    title : string;

    constructor(id: number, title: string){
        this.id   = id;
        this.title = title;
    }
}

class IndexFile {
    doc: FileInfo[];
    map: FileInfo[];
    img: FileInfo[];

    constructor(doc: FileInfo[], map: FileInfo[], img: FileInfo[]){
        this.doc = doc;
        this.map = map;
        this.img = img;
    }

    maxId(){
        return Math.max(... this.doc.concat(this.map).map(x => x.id));
    }
}


export function initFirebase(fnc:()=>void){
    firebase.auth().onAuthStateChanged(function(user: any) {
        loginUid = null;
        guestUid = defaultUid;
        
        if (user) {
            // User is signed in.
            msg(`login A ${user.uid} ${user.displayName} ${user.email}`);
    
            const user1 = firebase.auth().currentUser;
    
            if (user1) {
                // User is signed in.

                loginUid = user.uid;
                guestUid = user.uid;

                msg(`login B ${user1.uid} ${user1.displayName} ${user1.email}`);
            } 
            else {
                // No user is signed in.

                msg("ログアウト");
            }    
        } 
        else {
            // User is signed out.
            // ...

            msg("ログアウト");
        }

        fnc();
    });

    db = firebase.firestore();

    if(! inEditor){
        return;
    }

    dropZone = document.getElementById('drop-zone') as HTMLDivElement;

    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleFileSelect, false);
}

function writeDB(id: string, data: any, msg: string, fnc:()=>void){
    db.collection('users').doc(loginUid!).collection('docs').doc(id).set(data)
    .then(function() {
        console.log(msg);
        fnc();
    })
    .catch(function(error : any) {
        console.error("Error adding document: ", error);
    });
}

let pendingFiles : any[];
function fetchAllDoc(){
    if(pendingFiles.length != 0){
        let file = pendingFiles.pop();

        console.log(`fetch ${file.id} ${file.title}`);
        fetchText(`json/${file.id}.json`, (text: string)=>{

            db.collection('users').doc(loginUid!).collection('docs').doc(file.id).set(new TextFile(text))
            .then(function() {
                msg(`[${file.id}]${file.title} に書き込みました。`);
                fetchAllDoc();
            })
            .catch(function(error : any) {
                console.error("Error adding document: ", error);
            });
        });
    }
}

export function fetchDB(id: string, fnc:(data: any)=>void){
    db.collection('users').doc(loginUid!).collection('docs').doc(id).get()
    .then(function(doc) {
        if (doc.exists) {
            let data = doc.data();
            fnc(data);
        } else {
            // doc.data() will be undefined in this case
            console.log("No such document!");
        }
    })
    .catch(function(error) {
        console.log("Error getting document:", error);
    });
}

function dbUpload(){
    fetchFileList((obj: any)=>{

        let file_map : { [id: string]: string } = {};
        for(let file of obj.files){
            console.log(`${file.id} ${file.title}`);
            file_map[file.id] = file.title;
        }

        for(let edge of obj.edges){
            console.log(`${edge.srcId}: ${file_map[edge.srcId]} --${edge.label}-> ${edge.dstId}: ${file_map[edge.dstId]}`);
        }

        let max_id = Math.max(... obj.files.map((x:any) => parseInt(x.id)));
        max_id++;
        console.log(`max_id: ${max_id}`);

        let map_data = new TextFile( JSON.stringify({ edges: obj.edges }) );

        writeDB(
            `${max_id}`, map_data, `[${max_id}]$ にマップを書き込みました。`,
            ()=>{
                let doc = obj.files.map((x:any) => new FileInfo(x.id, x.title));
                let root = new IndexFile(doc, [ new FileInfo(max_id, "依存関係") ], []);
    
                writeDB(
                    "index", root, `[${max_id}]$ にマップを書き込みました。`,
                    ()=>{
                        pendingFiles = obj.files.slice(0, 10);
                        fetchAllDoc();    
                    }
                );
            }
        );
    });
}

export function initDB(){
    function set_click(id: string, fnc:()=>void){
        let btn = getElement(id) as HTMLButtonElement;
        btn.disabled = false;

        btn.addEventListener("click", (ev: MouseEvent)=>{
            fnc();
        });    
    }
    initFirebase(()=>{
        set_click("db-upload", dbUpload);
        set_click("db-backup", dbBackup);
    });
}





function getImgRef(fileName: string, mode:string){
    // Create a root reference
    const storageRef = firebase.storage().ref();

    let uid: string;
    switch(mode){
    case "r": uid = guestUid; break;
    case "w": uid = loginUid!; break;
    default: throw new Error();
    }

    return storageRef.child(`/users/${uid}/img/${fileName}`);
}

export function setSvgImgDB(img: SVGImageElement, fileName: string){
    const imgRef = getImgRef(fileName, "r");

    imgRef.getDownloadURL().then(function(downloadURL: string) {
        msg(`download URL: [${downloadURL}]`);
        
        img.setAttributeNS('http://www.w3.org/1999/xlink','href',downloadURL);
    });
}

export function setImgSrc(img: HTMLImageElement, fileName: string){
    const imgRef = getImgRef(fileName, "r");

    imgRef.getDownloadURL().then(function(downloadURL: string) {
        msg(`download URL: [${downloadURL}]`);

        img.src = downloadURL;
    });
}

function uploadFile(file: File){
    // Create a reference to 'mountains.jpg'
    const imgRef = getImgRef(file.name, "w");

    imgRef.put(file).then(function(snapshot: any) {
        snapshot.ref.getDownloadURL().then(function(downloadURL: string) {
            msg(`download URL: [${downloadURL}]`);

            dropZone.style.display = "none";            
        });

        //-- const act = new Image().make({fileName:file.name});
        //-- actions.push(act);
    });    
}


function handleFileSelect(ev: DragEvent) {
    ev.stopPropagation();
    ev.preventDefault();

    const files = ev.dataTransfer!.files; // FileList object.

    for (let f of files) {
        msg(`drop name:${escape(f.name)} type:${f.type} size:${f.size} mtime:${f.lastModified.toLocaleString()} `);

        uploadFile(f);
    }
}

function handleDragOver(evt: DragEvent) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer!.dropEffect = 'copy'; // Explicitly show this is a copy.
}

export function dbBackup(){
    db.collection('users').doc(loginUid!).collection('docs').get()
    .then((querySnapshot: any) => {
        let docs : any[] = [];

        querySnapshot.forEach((dt: any) => {
            const doc = dt.data() as Doc;

            docs.push({
                id  : dt.id,
                doc : doc
            });
        });

        let text = JSON.stringify(docs, null, 4);

        var link = getElement('download-link') as HTMLAnchorElement;

        var blob = new Blob([ text ], { "type" : "text/plain" });

        let dt = new Date();
        link.download = `backup-${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}-${dt.getHours()}-${dt.getMinutes()}.json`;
        link.href = window.URL.createObjectURL(blob);
        link.click();

        // link.setAttribute('download', `gan-${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}-${dt.getHours()}-${dt.getMinutes()}.png`);
        // link.setAttribute('href', canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));

        navigator.clipboard.writeText(text).then(
        function() {
            msg("copy OK");
        }, 
        function() {
            msg("copy error");
        });
    });    
}

}
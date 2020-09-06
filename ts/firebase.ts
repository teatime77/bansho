namespace bansho {
// declare let firebase: any;
declare let navigator : any;

export let dropZone : HTMLDivElement;

let inEditor : boolean = false;

// https://github.com/firebase/firebase-js-sdk をクローン
// firebase-js-sdk/packages/firebase/index.d.ts を firebase.d.tsにリネームする。
let db: firebase.firestore.Firestore;

const defaultUid = "qQTgoL6riZMpmFhU6KDvLfEwg5x1";  // "Rb6xnDguG5Z9Jij6XLIPHV4oNge2";
let loginUid : string | null = null;
let guestUid = defaultUid;

export let indexFile: IndexFile;

export class Doc {
    // title   : string = "";
    // widgets : Widget[] = [];
}

class TextFile {
    text   : string;

    constructor(text: string){
        this.text = text;
    }
}

export class FileInfo {
    id!    : number;
    title! : string;
}

function newFileInfo(id: number, title: string){
    return {
        id   : id,
        title: title
    } as FileInfo;
}

export class IndexFile {
    docs!: FileInfo[];
    maps!: FileInfo[];
    imgs!: FileInfo[];
}

function newIndexFile(doc: FileInfo[], map: FileInfo[], img: FileInfo[]){
    return {
        docs: doc,
        maps: map,
        imgs: img
    } as IndexFile;
}

function cloneIndexFile(){
    let obj = {
        docs: indexFile.docs.map(x => Object.assign({}, x)),
        maps: indexFile.maps.map(x => Object.assign({}, x)),
        imgs: indexFile.imgs.map(x => Object.assign({}, x)),
    };

    return obj;
}

function maxFileId(){
    return Math.max(... indexFile.docs.concat(indexFile.maps).map(x => x.id));
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

        fetchDB("index", (id: string | null, data:any)=>{
            if(data != null){
                indexFile = data;
            }
            else{
                indexFile = { docs: [], maps: [], imgs: [] };
            }

            fnc();
        });
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

export function putNewDoc(is_new: boolean, title: string, text: string, fnc:()=>void){
    let tmpIdx = cloneIndexFile();

    let id : number;
    let set_index = false;

    if(is_new){

        id = maxFileId() + 1;

        let inf = newFileInfo(id, title);
        tmpIdx.docs.push(inf);
        set_index = true;
    }
    else{
        id = glb.docID;

        let inf = tmpIdx.docs.find(x => x.id == id);
        if(inf == undefined){
            throw new Error();
        }

        if(inf.title != title){
            set_index = true;
            inf.title = title;
        }
    }

    let doc = { text: text };

    let batch = db.batch();

    // FirebaseError: Function WriteBatch.set() called with invalid data. Data must be an object, but it was: a custom object
    //  https://stackoverflow.com/questions/48156234/function-documentreference-set-called-with-invalid-data-unsupported-field-val
    let docRef = db.collection('users').doc(loginUid!).collection('docs').doc(`${id}`);
    batch.set(docRef, doc);

    if(set_index){

        let idxRef = db.collection('users').doc(loginUid!).collection('docs').doc("index");
        batch.set(idxRef, tmpIdx);
    }

    batch.commit().then(function () {
        indexFile = tmpIdx;
        fnc();
    });
}

export function delDoc(id: number){
    let tmpIdx = cloneIndexFile();

    for(let [idx, doc] of tmpIdx.docs.entries()){
        if(doc.id == id){
            tmpIdx.docs.splice(idx, 1);
            break;
        }
    }

    let batch = db.batch();

    let docRef = db.collection('users').doc(loginUid!).collection('docs').doc(`${id}`);
    batch.delete(docRef);

    let idxRef = db.collection('users').doc(loginUid!).collection('docs').doc("index");
    batch.set(idxRef, tmpIdx);

    batch.commit().then(function () {
        indexFile = tmpIdx;
        alert("削除しました。");
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

export function fetchDB(id: string, fnc:(data_id: string | null, data: any)=>void){
    db.collection('users').doc(guestUid).collection('docs').doc(id).get()
    .then(function(doc) {
        if (doc.exists) {
            console.assert(doc.id == id);
            let data = doc.data();
            fnc(doc.id, data);
        } else {
            // doc.data() will be undefined in this case
            console.log("No such document!");
            fnc(null, null);
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
                let doc = obj.files.map((x:any) => newFileInfo(x.id, x.title));
                console.assert(false);
                let root = newIndexFile(doc, [ newFileInfo(max_id, "依存関係") ], []);
    
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
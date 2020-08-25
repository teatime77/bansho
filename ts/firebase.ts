namespace bansho {
// declare let firebase: any;
declare let navigator : any;

let textName  : HTMLInputElement;
let fileTreeView : HTMLUListElement;
let dlgFolder : HTMLDivElement;
let txtRaw : HTMLTextAreaElement;
export let dropZone : HTMLDivElement;

let inEditor : boolean = false;
function newDocument(){}
function openActionData(text: string){}
function serializeActions(){ return ""};
function reviseJson(text: string){ return ""; }

// https://github.com/firebase/firebase-js-sdk をクローン
// firebase-js-sdk/packages/firebase/index.d.ts を firebase.d.tsにリネームする。
let db: firebase.firestore.Firestore;

const defaultUid = "Rb6xnDguG5Z9Jij6XLIPHV4oNge2";
let loginUid : string | null = null;
let guestUid = defaultUid;

let rootFile : FileInfo | null = null;
let selectedFile: FileInfo;

class Doc {
    ctime  : number = 0;
    mtime  : number = 0;
    text   : string = "";
}

class FileInfo {
    name : string;
    id : number;
    children : FileInfo[] | undefined;

    constructor(name : string, isFile: boolean){
        this.name = name;
        this.id = getMaxFileId() + 1;

        if(! isFile){

            this.children = [];
        }
    }
}

function getAllFileInfo() : FileInfo[] {
    function fnc(info: FileInfo, files: FileInfo[]){

        files.push(info);

        if(info.children != undefined){

            for(let x of info.children){
                fnc(x, files);
            }
        }
    }

    const files : FileInfo[] = [];
    fnc(rootFile!, files);

    return files;
}

function getMaxFileId() : number {
    return Math.max(... getAllFileInfo().map(x => x.id));
}

function getFileById(id: number) : FileInfo | undefined{
    return getAllFileInfo().find(x => x.id == id);
}

function showFileTreeView(){
    function fnc(file:FileInfo, ul: HTMLUListElement){
        const li = document.createElement("li") as HTMLLIElement;
        ul.appendChild(li);

        const span = document.createElement("span");
        span.className = "span-file";
        span.innerHTML = file.name;
        span.addEventListener("click", function(ev:MouseEvent){
            ev.stopPropagation();

            const spans = fileTreeView.getElementsByClassName("span-file");
            for(let x of spans){

                (x as HTMLSpanElement).style.backgroundColor = "white";
            }

            const fileId = parseInt( this.dataset.fileId! );
            selectedFile = getFileById(fileId)!;
            console.assert(selectedFile != undefined);

            this.style.backgroundColor = "lightgray";

            readFile(selectedFile, function(data:string){
                txtRaw.value = data;
            });
        });
        span.dataset.fileId = "" + file.id;

        li.appendChild(span);

        if(file.children != undefined){
            const ul2 = document.createElement("ul");
            li.appendChild(ul2);

            for(let x of file.children){
                fnc(x, ul2);
            }
        }
    }

    fileTreeView.innerHTML = "";
    fnc(rootFile!, fileTreeView);
}

function readFile(file: FileInfo, fnc:(data:string)=>void){
    db.collection('users').doc(guestUid).collection('docs').doc("" + file.id).get().then(function(doc:any) {
        if (doc.exists) {
            const docData = doc.data() as Doc;

            fnc(docData.text);
        } 
        else {
            // doc.data() will be undefined in this case

            msg(`[${file.id}]${file.name} はありません。`);
        }
    })
    .catch(function(error: any) {
        msg(`[${file.id}]${file.name} の読み込みエラーです。`);
    });
}

function showContents(){
    newDocument();

    function fnc(file:FileInfo, ul: HTMLUListElement){
        const li = document.createElement("li") as HTMLLIElement;
        ul.appendChild(li);

        if(file.children == undefined){
            // ファイルの場合

            const link = document.createElement("button");
            link.innerHTML = file.name;
            link.dataset.fileId = "" + file.id;
            link.addEventListener("click", function(ev:MouseEvent){
                ev.stopPropagation();

                const fileId = parseInt( this.dataset.fileId! );

                const file = getFileById(fileId);
                console.assert(file != undefined);

                readFile(file!, openActionData);

                msg(`click:${fileId} ${this.textContent}`);
            });

            li.appendChild(link);
        }
        else{
            // フォルダーの場合

            const span = document.createElement("span");
            span.innerHTML = file.name;
            li.appendChild(span);

            const ul2 = document.createElement("ul");
            li.appendChild(ul2);

            for(let x of file.children){
                fnc(x, ul2);
            }
        }
    }

    const rootUl = document.getElementById("ulContents") as HTMLUListElement;
    rootUl.innerHTML = "";
    fnc(rootFile!, rootUl);
}

function readFileTree(userUid: string){
    db.collection('users').doc(userUid).collection('docs').doc("root").get()
    .then(function(doc: any) {
        if (doc.exists) {
            const docData = doc.data() as Doc;

            if(docData.text != undefined){

                rootFile = JSON.parse(docData.text);

                if(inEditor){

                    (document.getElementById("btn-open-folder") as HTMLButtonElement).disabled = false;
                }
            }
            else{

                rootFile = new FileInfo("root", false);
            }
        } 
        else {
            // doc.data() will be undefined in this case
            msg("No such document!");

            rootFile = new FileInfo("root", false);
        }

        if(inEditor){

            showFileTreeView();
        }
        else{

            showContents();
        }
    })
    .catch(function(error : any) {
        msg(`Error getting document:${error}`);
        rootFile = new FileInfo("root", false);
    });
}

export function initFirebase(){
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

        rootFile = { name: "root", id: 123} as FileInfo;
        writeUserData();
        //-- readFileTree(guestUid);
    });

    db = firebase.firestore();

    if(! inEditor){
        return;
    }

    textName  = document.getElementById("text-name") as HTMLInputElement;
    fileTreeView = document.getElementById("file-tree-view") as HTMLUListElement;
    dlgFolder = document.getElementById("dlg-Folder") as HTMLDivElement;
    txtRaw = document.getElementById("txt-raw") as HTMLTextAreaElement;
    dropZone = document.getElementById('drop-zone') as HTMLDivElement;

    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleFileSelect, false);
}

function writeUserData(){
    const ctime = Math.round((new Date()).getTime());

    db.collection('users').doc(loginUid!).collection('docs').doc("root").set({
        ctime  : ctime,
        mtime  : ctime,
        text   : JSON.stringify(rootFile)
    })
    .then(function() {
        msg("Document successfully written!");
    })
    .catch(function(error : any) {
        console.error("Error writing document: ", error);
    });
}

export function openFolder(){
    showFileTreeView();
    showPopup(dlgFolder);
}

export function closeFolder(){
    hidePopup(dlgFolder);
}

export function saveFolder(){
    writeUserData();

    hidePopup(dlgFolder);
}


export function makeFolder(){
    const name = textName.value.trim();
    const newFolder = new FileInfo(name, false);

    selectedFile.children!.push(newFolder);

    showFileTreeView();
}

function writeFile(file: FileInfo, text: string){
    const ctime = Math.round((new Date()).getTime());

    db.collection('users').doc(loginUid!).collection('docs').doc("" + file.id).set({
        ctime  : ctime,
        mtime  : ctime,
        text   : text
    })
    .then(function() {
        msg(`[${file.id}]${file.name} に書き込みました。`);
    })
    .catch(function(error : any) {
        console.error("Error adding document: ", error);
    });
}

export function firebaseUpdate(){
    const text = serializeActions();
    msg(`${text}`);

    msg("------------------------------------");
    const s = reviseJson(text);
    msg(s);
    msg("------------------------------------");
    const obj = JSON.parse(s);
    msg(`${JSON.stringify(obj)}`);

    writeFile(selectedFile, text);
}

function showPopup(div: HTMLDivElement){
    div.style.display = "grid"; // "inline-block";
    div.style.position = "fixed";
    div.style.left = "20px";
    div.style.top  = "20px";
    // div.style.width = `${window.innerWidth - 50}px`;
    // div.style.height = `${window.innerHeight - 50}px`;
    div.style.width = `${document.documentElement.clientWidth - 50}px`;
    div.style.height = `${document.documentElement.clientHeight - 50}px`;
}

function hidePopup(div: HTMLDivElement){
    div.style.display = "none";
}

export function openFile(){
    newDocument();

    const file = selectedFile;
    hidePopup(dlgFolder);

    db.collection('users').doc(guestUid).collection('docs').doc("" + file.id).get().then(function(doc: any) {
        if (doc.exists) {
            const docData = doc.data() as Doc;

            openActionData(docData.text);       

            msg(`[${file.id}]${file.name} を読みこみました。`);
        } 
        else {
            // doc.data() will be undefined in this case

            msg(`[${file.id}]${file.name} はありません。`);
        }
    });
    // .catch(function(error) {
    //     console.log(error.message, error);
    //     console.log(error.stack);

    //     msg(`[${file.id}]${file.name} の読み込みエラーです。`);
    // });
}

export function makeFile(){
    const name = textName.value.trim();
    const newFile = new FileInfo(name, true);

    writeFile(newFile, "");

    selectedFile.children!.push(newFile);

    showFileTreeView();
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

export function writeRawText(){
    writeFile(selectedFile, txtRaw.value);
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

export function backup(){

    db.collection('users').doc(loginUid!).collection('docs').get()
    .then((querySnapshot: any) => {
        let text: string = "";

        querySnapshot.forEach((dt: any) => {
            const doc = dt.data() as Doc;

            text += `id: ${dt.id}\n`;
            text += `ctime: ${doc.ctime}\n`;
            text += `mtime: ${doc.mtime}\n`;
            text += `${doc.text}<<EndOfDocument>>\n\n`;
        });

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
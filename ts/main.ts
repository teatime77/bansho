import { msg, runGenerator, tostr, makeHtmlLines } from "./util";
import { speak, cancelSpeech, isSpeaking, initSpeech } from "./speech";
import { ui } from "./edit";
import { glb, Widget, EmptyWidget, TextBlockWidget, SelectionWidget, TextWidget, reprocessMathJax } from "./widget"
import { SpeechWidget } from "./speech";

// namespace bansho {

export class UI {
    prevTimePos : number;
    pauseFlag : boolean;

    btnPlayPause: HTMLButtonElement;

    isPlaying = false;

    constructor(div: HTMLDivElement){
        this.prevTimePos = -1;
        this.pauseFlag = false;

        this.btnPlayPause = document.createElement("button");
        this.btnPlayPause.disabled = true;
        this.btnPlayPause.style.fontFamily = "Segoe UI Emoji";
        this.btnPlayPause.style.fontSize = "40px";
        this.btnPlayPause.innerHTML = "⏹";
        div.appendChild(this.btnPlayPause);

        div.appendChild(glb.timeline);

        div.appendChild(glb.board);

        div.appendChild(glb.caption);
    }
        
    onOpenDocComplete = ()=>{
        this.btnPlayPause.disabled = false;
        this.btnPlayPause.innerHTML = "▶️";
    }  

    clickPlayPause(){
        if(this.isPlaying){
    
            this.btnPlayPause.disabled = true;
            pauseWidget(this, ()=>{
                this.btnPlayPause.disabled = false;
                this.btnPlayPause.innerHTML = "▶️";
            });
        }
        else{
    
            this.btnPlayPause.innerHTML = "⏸";
            this.playWidgets(()=>{
    
                this.btnPlayPause.innerHTML = "▶️";
                this.isPlaying = false;
            });
        }
        this.isPlaying = ! this.isPlaying;
        // document.getElementById("btn-play").style.display="none";
    }

    rngTimelineChange(){
        msg(`changed`);
        while(glb.widgets.some(x => x instanceof EmptyWidget)){
            let idx = glb.widgets.findIndex(x => x instanceof EmptyWidget);
            glb.widgets.splice(idx, 1);
        }
    
        this.prevTimePos = Math.min(this.prevTimePos, glb.widgets.length - 1);
        glb.timeline.max = `${glb.widgets.length - 1}`;
        this.updateTimePos(glb.timeline.valueAsNumber);
    }

    currentWidget() : Widget | undefined {
        if(glb.timeline.valueAsNumber != -1){
            return glb.widgets[glb.timeline.valueAsNumber];
        }
        else{
            return undefined;
        }
    }

    updateTimePos(pos: number){
        if(this.prevTimePos < pos){
            for(let i = this.prevTimePos + 1; i <= pos; i++){
                glb.widgets[i].enable();
            }
        }
        else if(pos < this.prevTimePos){
            for(let i = Math.min(this.prevTimePos, glb.widgets.length - 1); pos < i; i--){
                glb.widgets[i].disable();
            }
        }
    
        glb.board.scrollTop = glb.board.scrollHeight;
        window.scrollTo(0,document.body.scrollHeight);
    
        if(glb.timeline.valueAsNumber != pos){
    
            glb.timeline.valueAsNumber = pos;
        }
    
        this.prevTimePos = pos;
    
        let act = this.currentWidget();
        if(act instanceof SpeechWidget){
            
            let [caption, speech] = act.getCaptionSpeech();
            glb.caption.textContent = caption;
            reprocessMathJax(act, glb.caption, caption);
        }
        else{

            glb.caption.textContent = "";
        }
    }    
    
    playWidgets(oncomplete:()=>void){
        function* fnc(ui: UI){
            let startPos = Math.max(0, glb.timeline.valueAsNumber);
    
            for(let pos = startPos; pos < glb.widgets.length; pos++){
                let act = glb.widgets[pos];
                yield* act.play();
                ui.updateTimePos(pos);
    
                if(ui.pauseFlag){
                    break;
                }
            }
    
            if(ui.pauseFlag){
    
                ui.pauseFlag = false;
            }
            else{
    
                if(oncomplete != undefined){
    
                    oncomplete();
                }
            }
        }
        
        runGenerator( fnc(this) );
    }
}




export function pauseWidget(ui: UI, fnc:()=>void){
    ui.pauseFlag = true;
    cancelSpeech();

    const id = setInterval(function(){
        if(! ui.pauseFlag && ! isSpeaking){

            clearInterval(id);
            msg("停止しました。");
            fnc();
        }
    },10);
}



// }


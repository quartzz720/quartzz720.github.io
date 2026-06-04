const canvas = document.getElementById("screen");

const ctx = canvas.getContext("2d");



const DB_NAME = "WasmOS_State";

const STORE_NAME = "MemoryState_Win95V4"; // Bumped store name due to C recompilation!



let wasmInstance;

let memoryBuffer;

let vramPtr;



// Import functions provided back to C

const importObject = {

    env: {

        js_download: (type) => {

            if (type === 4) { // Notepad

                const ptr = wasmInstance.exports.get_notepad_ptr();

                const bytes = new Uint8Array(memoryBuffer.buffer, ptr, 1024);

                let str = "";

                for (let i = 0; i < bytes.length; i++) {

                    if (bytes[i] === 0) break;

                    str += String.fromCharCode(bytes[i]);

                }

                const blob = new Blob([str], { type: "text/plain" });

                const a = document.createElement("a");

                a.href = URL.createObjectURL(blob);

                a.download = "note.txt";

                a.click();

            } else if (type === 5) { // Paint

                const w = 240, h = 160;

                const ptr = wasmInstance.exports.get_paint_ptr();

                const memory32 = new Uint32Array(memoryBuffer.buffer, ptr, w * h);

                const tempCanvas = document.createElement("canvas");

                tempCanvas.width = w; tempCanvas.height = h;

                const tCtx = tempCanvas.getContext("2d");

                const imgData = tCtx.createImageData(w, h);

                for (let i = 0; i < w * h; i++) {

                    let color = memory32[i];

                    imgData.data[i * 4] = (color >> 16) & 0xFF;     // R

                    imgData.data[i * 4 + 1] = (color >> 8) & 0xFF;  // G

                    imgData.data[i * 4 + 2] = color & 0xFF;         // B

                    imgData.data[i * 4 + 3] = (color >> 24) & 0xFF; // A

                }

                tCtx.putImageData(imgData, 0, 0);

                const a = document.createElement("a");

                a.href = tempCanvas.toDataURL("image/png");

                a.download = "drawing.png";

                a.click();

            }

        },

        js_save_state: () => {

            saveToIndexedDB();

        }

    }

};



// Open IndexedDB

function openDB() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, 6); // Bump version for new schema

        request.onupgradeneeded = (e) => {

            const db = e.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {

                db.createObjectStore(STORE_NAME);

            }

        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}



window.bootOS = () => {

    if (wasmInstance) wasmInstance.exports.sys_power(1);

};

window.rebootOS = () => {

    if (wasmInstance) wasmInstance.exports.sys_power(2);

};



async function start() {

    const db = await openDB();

    const tx = db.transaction(STORE_NAME, "readonly");

    const store = tx.objectStore(STORE_NAME);

    const getReq = store.get("mem");



    getReq.onsuccess = async (e) => {

        const savedData = e.target.result;



        const response = await fetch("os.wasm");

        const bytes = await response.arrayBuffer();

        const { instance } = await WebAssembly.instantiate(bytes, importObject);

        wasmInstance = instance;

        memoryBuffer = wasmInstance.exports.memory;

        

        let is_resume = 0;

        if (savedData && savedData.length === memoryBuffer.buffer.byteLength) {

            const memoryView = new Uint8Array(memoryBuffer.buffer);

            memoryView.set(savedData);

            console.log("Restored memory state.");

            is_resume = 1;

        } else {

            console.log("Starting fresh OS.");

        }



        wasmInstance.exports.os_init(is_resume);

        vramPtr = wasmInstance.exports.get_vram_ptr();



        requestAnimationFrame(render);

    };

}



async function saveToIndexedDB() {

    if (!memoryBuffer) return;

    const db = await openDB();

    const tx = db.transaction(STORE_NAME, "readwrite");

    const store = tx.objectStore(STORE_NAME);

    const data = new Uint8Array(memoryBuffer.buffer);

    store.put(data, "mem");

}



let lastAutoSave = 0;

function render(time) {

    if (!wasmInstance) return;



    // Time passing to C

    const now = new Date();

    wasmInstance.exports.set_time(now.getHours(), now.getMinutes(), now.getSeconds());



    // Update C logic

    wasmInstance.exports.update(time);



    // Auto-save every 5 seconds continuously

    if (time - lastAutoSave > 5000) {

        saveToIndexedDB();

        lastAutoSave = time;

    }



    // Draw C's VRAM to actual canvas

    const memory32 = new Uint32Array(memoryBuffer.buffer, vramPtr, 800 * 600);

    const imgData = new ImageData(800, 600);

    for (let i = 0; i < 800 * 600; i++) {

        let color = memory32[i];

        imgData.data[i * 4] = (color >> 16) & 0xFF;     // R

        imgData.data[i * 4 + 1] = (color >> 8) & 0xFF;  // G

        imgData.data[i * 4 + 2] = color & 0xFF;         // B

        imgData.data[i * 4 + 3] = (color >> 24) & 0xFF; // A

    }

    ctx.putImageData(imgData, 0, 0);



    requestAnimationFrame(render);

}



// Input Handlers

canvas.addEventListener("mousemove", (e) => {

    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;

    const scaleY = canvas.height / rect.height;

    wasmInstance?.exports.mouse_move((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);

});



canvas.addEventListener("mousedown", () => {

    wasmInstance?.exports.mouse_down_event();

});



canvas.addEventListener("mouseup", () => {

    wasmInstance?.exports.mouse_up();

});



window.addEventListener("keydown", (e) => {

    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key.startsWith("Arrow")) {

        e.preventDefault();

        let code = e.key.length === 1 ? e.key.charCodeAt(0) : 0;

        if (e.key === "Backspace") code = 8;

        if (e.key === "Enter") code = 13;

        if (e.key === "ArrowUp") code = 38;

        if (e.key === "ArrowDown") code = 40;

        if (e.key === "ArrowLeft") code = 37;

        if (e.key === "ArrowRight") code = 39;

        

        wasmInstance?.exports.key_down(code);

        saveToIndexedDB(); // Save on keypress for notepad resilience

    }

});



start();
const ctxMenu = document.createElement("div");
ctxMenu.style.position = "absolute";
ctxMenu.style.display = "none";
ctxMenu.style.backgroundColor = "#c0c0c0";
ctxMenu.style.border = "2px outset #ffffff";
ctxMenu.style.padding = "2px";
ctxMenu.style.zIndex = "1000";
ctxMenu.style.fontFamily = "monospace";
ctxMenu.innerHTML = `
    <div style="padding: 5px 15px; cursor: pointer;" onmouseover="this.style.backgroundColor='#0000a0'; this.style.color='#ffffff'" onmouseout="this.style.backgroundColor=''; this.style.color=''">New Folder</div>
    <div style="padding: 5px 15px; cursor: pointer;" onmouseover="this.style.backgroundColor='#0000a0'; this.style.color='#ffffff'" onmouseout="this.style.backgroundColor=''; this.style.color=''">New Text Document</div>
`;
document.body.appendChild(ctxMenu);

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    ctxMenu.style.display = "block";
    ctxMenu.style.left = e.pageX + "px";
    ctxMenu.style.top = e.pageY + "px";
});

window.addEventListener("click", () => { ctxMenu.style.display = "none"; });

ctxMenu.children[0].onclick = () => { if(wasmInstance) wasmInstance.exports.sys_create_file(1); };
ctxMenu.children[1].onclick = () => { if(wasmInstance) wasmInstance.exports.sys_create_file(0); };

const ctxMenu = document.createElement("div");
ctxMenu.style.position = "absolute";
ctxMenu.style.display = "none";
ctxMenu.style.backgroundColor = "#c0c0c0";
ctxMenu.style.border = "2px outset #ffffff";
ctxMenu.style.padding = "2px";
ctxMenu.style.zIndex = "1000";
ctxMenu.style.fontFamily = "monospace";
ctxMenu.innerHTML = 
    <div style="padding: 5px 15px; cursor: pointer;" onmouseover="this.style.backgroundColor='#0000a0'; this.style.color='#ffffff'" onmouseout="this.style.backgroundColor=''; this.style.color=''">New Folder</div>
    <div style="padding: 5px 15px; cursor: pointer;" onmouseover="this.style.backgroundColor='#0000a0'; this.style.color='#ffffff'" onmouseout="this.style.backgroundColor=''; this.style.color=''">New Text Document</div>
;
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

import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "fs";
import pkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = pkg;
const c=createCanvas(400,400); const x=c.getContext("2d");
x.beginPath(); x.arc(200,200,150,0,Math.PI*2); x.fillStyle="#ef4444"; x.fill(); x.lineWidth=16; x.strokeStyle="#fff"; x.stroke();
const img=await (await import("@napi-rs/canvas")).loadImage(c.toBuffer("image/png"));
const size=360,frames=14, cc=createCanvas(size,size), cx=cc.getContext("2d");
const m=size*0.14,area=size-m*2,scale=Math.min(area/img.width,area/img.height),w0=img.width*scale,h0=img.height*scale;
const gif=GIFEncoder();
for(let f=0;f<frames;f++){const ph=Math.sin(f/frames*Math.PI*2);cx.clearRect(0,0,size,size);cx.save();
let dy=(size-h0)/2-ph*size*0.07,dx=(size-w0)/2;cx.drawImage(img,dx,dy,w0,h0);cx.restore();
const {data}=cx.getImageData(0,0,size,size);const pal=quantize(data,256,{format:"rgba4444"});const idx=applyPalette(data,pal,"rgba4444");
gif.writeFrame(idx,size,size,{palette:pal,transparent:true,delay:80,dispose:2});}
gif.finish();const buf=Buffer.from(gif.bytes());writeFileSync("_anim.gif",buf);
let fr=0;for(let i=0;i<buf.length;i++)if(buf[i]===0x2c)fr++;
console.log("GIF:",buf.length,"bytes | magic:",buf.subarray(0,6).toString("ascii"),"| 프레임:",fr);

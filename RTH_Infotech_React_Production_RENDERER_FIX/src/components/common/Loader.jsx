import { useEffect, useState } from "react";
export default function Loader(){ const [done,setDone]=useState(false); useEffect(()=>{const t=setTimeout(()=>setDone(true),720);return()=>clearTimeout(t)},[]); return <div className={`loader ${done?"loader-hidden":""}`}><span>INITIALIZING RTH AI</span><i /></div>; }

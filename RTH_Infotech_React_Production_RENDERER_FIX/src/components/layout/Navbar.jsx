import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navigation } from "@/data/navigation";
import logo from "@/assets/logos/rth-logo.png";
export default function Navbar(){
 const [open,setOpen]=useState(false); const [compact,setCompact]=useState(false);
 useEffect(()=>{const onScroll=()=>setCompact(scrollY>90);addEventListener("scroll",onScroll,{passive:true});onScroll();return()=>removeEventListener("scroll",onScroll)},[]);
 useEffect(()=>{document.body.style.overflow=open?"hidden":"";return()=>{document.body.style.overflow=""}},[open]);
 return <header className={`navbar ${compact?"is-compact":""}`}><NavLink to="/" className="brand-logo" onClick={()=>setOpen(false)}><img src={logo} alt="RTH Infotech"/></NavLink><nav className="desktop-nav" aria-label="Primary navigation">{navigation.map(item=><NavLink key={item.path} to={item.path} end={item.path==="/"} className={({isActive})=>isActive?"active":""}>{item.label}</NavLink>)}</nav><button className="menu-button" aria-label={open?"Close menu":"Open menu"} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button><div className={`mobile-nav ${open?"open":""}`}>{navigation.map((item,i)=><NavLink style={{'--i':i}} key={item.path} to={item.path} onClick={()=>setOpen(false)}>{item.label}</NavLink>)}</div></header>
}

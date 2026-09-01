import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { services } from "@/data/services";
import { getOrbitPoint, getSvgOrbitPoint } from "@/utils/servicePosition";
import ServiceNode from "@/sections/Services/ServiceNode";
import ServiceCore from "@/sections/Services/ServiceCore";
import ServiceConnector from "@/sections/Services/ServiceConnector";
import { mountServiceOrbit } from "@/animations/serviceAnimations";
export default function ServiceUniverse({ compact=false }){
  const ref=useRef(null);
  const hintRef=useRef(null);
  const navigate=useNavigate();
  const {pathname}=useLocation();
  useLayoutEffect(()=>mountServiceOrbit(ref.current,hintRef.current,{compact}),[compact]);
  const openService=(service,el)=>{
    const go=()=>navigate(service.route,{state:{returnTo:{pathname,scrollY:window.scrollY}}});
    const launch=window.__rthNavigateFromServiceIcon;
    if(typeof launch==='function') launch({originEl:el,navigate:go});
    else go();
  };
  return <div ref={ref} className={`service-universe-wrap ${compact?'compact':''}`}>
    <div ref={hintRef} className="core-click-hint"><i>☝</i><span><b>CLICK / TAP ANY SERVICE</b><small>TO EXPLORE THE SYSTEM</small></span></div>
    <div className="service-orbit">
      <svg viewBox="0 0 1000 1000" className="connector-layer" aria-hidden="true">
        <circle cx="500" cy="500" r="370" className="orbit-circle"/>
        {services.map((s,i)=>{const p=getSvgOrbitPoint(i,services.length);return <ServiceConnector key={s.id} index={i} {...p}/>})}
      </svg>
      <div className="service-rotor">{services.map((s,i)=><ServiceNode key={s.id} service={s} point={getOrbitPoint(i,services.length)} index={i} onOpen={openService}/>)}</div>
      <ServiceCore/>
    </div>
  </div>
}

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import { animateServiceModal, closeServiceModal } from "@/animations/serviceAnimations";
import ServiceVisual from "@/sections/Services/ServiceVisual";
import { ServiceIcon } from "@/sections/Services/serviceIcons";
export default function ServiceDetail({service,originEl,onClose}){
  const panel=useRef(null);
  const scrim=useRef(null);
  const closingRef=useRef(false);
  const closeFnRef=useRef(()=>{});
  useLayoutEffect(()=>{
    closingRef.current=false;
    const originRect=originEl?.getBoundingClientRect();
    const a=animateServiceModal(panel.current,originRect);
    closeFnRef.current=()=>{
      if(closingRef.current)return;
      closingRef.current=true;
      closeServiceModal(panel.current,scrim.current,onClose,originEl?.getBoundingClientRect());
    };
    const esc=e=>e.key==='Escape'&&closeFnRef.current();
    addEventListener('keydown',esc);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{a.kill();removeEventListener('keydown',esc);document.body.style.overflow=prevOverflow};
  },[onClose,originEl]);
  const requestClose=()=>closeFnRef.current();
  return createPortal(<div className="service-modal" role="dialog" aria-modal="true" aria-label={service.title}><button ref={scrim} className="service-scrim" aria-label="Close service details" onClick={requestClose}/><article ref={panel} className="service-modal-panel" data-lenis-prevent><button className="modal-close" onClick={requestClose} aria-label="Close"><X/></button><div className="service-modal-copy"><div className="service-modal-tag"><ServiceIcon name={service.icon}/><span>{service.tag}</span></div><h3>{service.title}</h3><p>{service.description}</p><div className="metric-row">{service.metrics.map(m=><span key={m}>{m}</span>)}</div><div className="detail-columns"><div><h4>CAPABILITIES</h4><ul>{service.primaryFeatures.slice(0,6).map(f=><li key={f}>{f}</li>)}</ul></div><div><h4>TOOLS / SYSTEMS</h4><div className="tool-cloud">{service.tools.map(t=><span key={t}>{t}</span>)}</div></div></div><div className="process-row">{service.process.map((p,i)=><span key={p}><b>{String(i+1).padStart(2,'0')}</b>{p}</span>)}</div><Link to={service.route} className="modal-route-link">OPEN FULL SERVICE <ArrowRight size={16}/></Link></div><ServiceVisual service={service}/></article></div>,document.body)}

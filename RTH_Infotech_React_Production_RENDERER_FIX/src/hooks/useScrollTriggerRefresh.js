import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ScrollTrigger } from "@/animations/gsapConfig";
export default function useScrollTriggerRefresh(){const {pathname}=useLocation();useEffect(()=>{const id=requestAnimationFrame(()=>ScrollTrigger.refresh());return()=>cancelAnimationFrame(id);},[pathname]);}

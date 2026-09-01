export default function Container({ className="", children }) { return <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-7 lg:px-10 ${className}`}>{children}</div>; }

import { Link } from "react-router-dom";
// `type` defaults to "button": a bare <button> inside a form is a submit
// button, so an action button that happens to be placed in one (the contact
// form's own submit passes type="submit" explicitly) would otherwise submit it.
export default function Button({ to, href, children, variant="primary", type="button", className="", ...props }) {
  const classes=`rth-btn rth-btn-${variant} ${className}`;
  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  if (href) return <a href={href} className={classes} {...props}>{children}</a>;
  return <button type={type} className={classes} {...props}>{children}</button>;
}

import{hd as x,eX as y,eY as C,dl as i,he as g,dm as r,fn as l}from"./index-CsujRuQK.js";import{n as j}from"./styles-DVyDvTdj-R_d5Jl8b.js";import{i as a,l as c,s as d,Q as w}from"./styles-tjTwTW2h-DyQhlE5c.js";import{c as b}from"./createLucideIcon-CR5_yFTU.js";import{C as k}from"./credit-card-By1FxiCI.js";import"./ScreenLayout-DTsWfKKs-D1WqMINw.js";import"./ModalFooter-DKyozrEX-DUgK1TQa.js";import"./Screen-DMmH56yL-B6M8vm1u.js";import"./index-CWARkn2w-BKoogCPy.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],u=b("banknote",v),M={component:()=>{let e=x(),{onUserCloseViaDialogOrKeybindRef:s}=y(),p=C(),t=i.useRef(!1);i.useEffect(()=>{e&&(t.current=!1)},[e]);let o=i.useCallback(async()=>{!t.current&&e&&(t.current=!0,g(),await e.onCancel())},[e]);return i.useEffect(()=>(s.current=o,()=>{s.current===o&&(s.current=null)}),[o,s]),e?e.error?r.jsx(a,{icon:u,iconVariant:"warning",title:"Unable to add funds",subtitle:e.error,showClose:!0,onClose:o,primaryCta:{label:"Close",onClick:o}}):r.jsx(a,{icon:u,iconVariant:"subtle",title:"Select method",subtitle:"Choose how to fund your wallet",showClose:!0,onClose:o,children:r.jsxs(j,{style:{marginTop:"1rem"},$colorScheme:p.appearance.palette.colorScheme,children:[e.startFiat&&r.jsxs(c,{onClick:async()=>{var n;t.current||(t.current=!0,await((n=e.startFiat)==null?void 0:n.call(e)))},children:[r.jsx(h,{children:r.jsx(k,{})}),r.jsxs(m,{children:[r.jsx(d,{children:"Pay with fiat"}),r.jsx(f,{children:"Apple Pay, Google Pay, or debit card"})]})]}),e.startCrypto&&r.jsxs(c,{onClick:async()=>{var n;t.current||(t.current=!0,await((n=e.startCrypto)==null?void 0:n.call(e)))},children:[r.jsx(h,{children:r.jsx(w,{})}),r.jsxs(m,{children:[r.jsx(d,{children:"Transfer from wallet"}),r.jsx(f,{children:"Send crypto from any wallet"})]})]})]})}):null}};let h=l.span`
  width: 2rem;
  height: 2rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-2);
  color: var(--privy-color-icon-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`,m=l.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,f=l.span`
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--privy-color-foreground-3);
`;export{M as AddFundsSelectionScreen,M as default};

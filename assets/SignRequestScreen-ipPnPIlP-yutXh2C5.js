import{fE as M,eZ as k,eX as N,dl as r,hB as O,fK as E,gG as C,gH as T,dm as a,fA as z,fn as p,fO as I,hC as q,hD as P}from"./index-CsujRuQK.js";import{h as F}from"./CopyToClipboard-i_OQSBJr-CSf6vdXp.js";import{d as $}from"./Layouts-BMRfo5hw-DKy2GTE9.js";import{a as H,i as V}from"./JsonTree-BHzNC-ic-CVOzk8sM.js";import{n as J}from"./ScreenLayout-DTsWfKKs-D1WqMINw.js";import{c as K}from"./createLucideIcon-CR5_yFTU.js";import"./ModalFooter-DKyozrEX-DUgK1TQa.js";import"./Screen-DMmH56yL-B6M8vm1u.js";import"./index-CWARkn2w-BKoogCPy.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],G=K("square-pen",B),Q=p.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`;let U=e=>{if(!I(e))return e;try{let s=q(e);return s.includes("�")?e:s}catch{return e}},W=e=>{try{let s=P.decode(e),n=new TextDecoder().decode(s);return n.includes("�")?e:n}catch{return e}},X=e=>{let{types:s,primaryType:n,...l}=e.typedData;return a.jsxs(a.Fragment,{children:[a.jsx(te,{data:l}),a.jsx(F,{text:(o=e.typedData,JSON.stringify(o,null,2)),itemName:"full payload to clipboard"})," "]});var o};const Z=({method:e,messageData:s,copy:n,iconUrl:l,isLoading:o,success:g,walletProxyIsLoading:m,errorMessage:h,isCancellable:d,onSign:c,onCancel:f,onClose:u})=>a.jsx(J,{title:n.title,subtitle:n.description,showClose:!0,onClose:u,icon:G,iconVariant:"subtle",helpText:h?a.jsx(ee,{children:h}):void 0,primaryCta:{label:n.buttonText,onClick:c,disabled:o||g||m,loading:o},secondaryCta:d?{label:"Not now",onClick:f,disabled:o||g||m}:void 0,watermark:!0,children:a.jsxs($,{children:[l?a.jsx(Q,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,a.jsxs(Y,{children:[e==="personal_sign"&&a.jsx(w,{children:U(s)}),e==="eth_signTypedData_v4"&&a.jsx(X,{typedData:s}),e==="solana_signMessage"&&a.jsx(w,{children:W(s)})]})]})}),ue={component:()=>{let{authenticated:e}=M(),{initializeWalletProxy:s,closePrivyModal:n}=k(),{navigate:l,data:o,onUserCloseViaDialogOrKeybindRef:g}=N(),[m,h]=r.useState(!0),[d,c]=r.useState(""),[f,u]=r.useState(),[y,b]=r.useState(null),[R,S]=r.useState(!1);r.useEffect(()=>{e||l("LandingScreen")},[e]),r.useEffect(()=>{s(O).then(i=>{h(!1),i||(c("An error has occurred, please try again."),u(new E(new C(d,T.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))})},[]);let{method:_,data:v,confirmAndSign:j,onSuccess:D,onFailure:A,uiOptions:t}=o.signMessage,L={title:(t==null?void 0:t.title)||"Sign message",description:(t==null?void 0:t.description)||"Signing this message will not cost you any fees.",buttonText:(t==null?void 0:t.buttonText)||"Sign and continue"},x=i=>{i?D(i):A(f||new E(new C("The user rejected the request.",T.E4001_USER_REJECTED_REQUEST.eipCode))),n({shouldCallAuthOnSuccess:!1}),setTimeout(()=>{b(null),c(""),u(void 0)},200)};return g.current=()=>{x(y)},a.jsx(Z,{method:_,messageData:v,copy:L,iconUrl:t!=null&&t.iconUrl&&typeof t.iconUrl=="string"?t.iconUrl:void 0,isLoading:R,success:y!==null,walletProxyIsLoading:m,errorMessage:d,isCancellable:t==null?void 0:t.isCancellable,onSign:async()=>{S(!0),c("");try{let i=await j();b(i),S(!1),setTimeout(()=>{x(i)},z)}catch(i){console.error(i),c("An error has occurred, please try again."),u(new E(new C(d,T.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),S(!1)}},onCancel:()=>x(null),onClose:()=>x(y)})}};let Y=p.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,ee=p.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,te=p(H)`
  margin-top: 0;
`,w=p(V)`
  margin-top: 0;
`;export{ue as SignRequestScreen,Z as SignRequestView,ue as default};

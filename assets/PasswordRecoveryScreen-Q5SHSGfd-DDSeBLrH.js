import{dl as a,fE as _,eZ as E,eX as T,dm as e,gv as I,gw as F,gd as U,fn as p,fu as W}from"./index-CsujRuQK.js";import{F as N}from"./ShieldCheckIcon-axpOYYW-.js";import{b as V}from"./ModalFooter-DKyozrEX-DUgK1TQa.js";import{l as H}from"./Layouts-BMRfo5hw-DKy2GTE9.js";import{g as M,h as O,y as q,w as z,k as B}from"./shared-DEkT-Gv3-BgiSORKu.js";import{w as t}from"./Screen-DMmH56yL-B6M8vm1u.js";import"./index-CWARkn2w-BKoogCPy.js";const re={component:()=>{let[o,y]=a.useState(!0),{authenticated:m,user:b}=_(),{walletProxy:i,closePrivyModal:v,createAnalyticsEvent:f,client:j}=E(),{navigate:k,data:A,onUserCloseViaDialogOrKeybindRef:$}=T(),[n,C]=a.useState(void 0),[x,d]=a.useState(""),[c,g]=a.useState(!1),{entropyId:u,entropyIdVerifier:S,onCompleteNavigateTo:w,onSuccess:h,onFailure:P}=A.recoverWallet,l=(r="User exited before their wallet could be recovered")=>{v({shouldCallAuthOnSuccess:!1}),P(typeof r=="string"?new U(r):r)};return $.current=l,a.useEffect(()=>{if(!m)return l("User must be authenticated and have a Privy wallet before it can be recovered")},[m]),e.jsxs(t,{children:[e.jsx(t.Header,{icon:N,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:l}),e.jsx(t.Body,{children:e.jsx(D,{children:e.jsxs("div",{children:[e.jsxs(M,{children:[e.jsx(O,{type:o?"password":"text",onChange:r=>(s=>{s&&C(s)})(r.target.value),disabled:c,style:{paddingRight:"2.3rem"}}),e.jsx(q,{style:{right:"0.75rem"},children:o?e.jsx(z,{onClick:()=>y(!1)}):e.jsx(B,{onClick:()=>y(!0)})})]}),!!x&&e.jsx(K,{children:x})]})})}),e.jsxs(t.Footer,{children:[e.jsx(t.HelpText,{children:e.jsxs(H,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(t.Actions,{children:e.jsx(L,{loading:c||!i,disabled:!n,onClick:async()=>{g(!0);let r=await j.getAccessToken(),s=I(b,u);if(!r||!s||n===null)return l("User must be authenticated and have a Privy wallet before it can be recovered");try{f({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:s.address}}),await(i==null?void 0:i.recover({accessToken:r,entropyId:u,entropyIdVerifier:S,recoveryPassword:n})),d(""),w?k(w):v({shouldCallAuthOnSuccess:!1}),h==null||h(s),f({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:s.address}})}catch(R){F(R)?d("Invalid recovery password, please try again."):d("An error has occurred, please try again.")}finally{g(!1)}},$hideAnimations:!u&&c,children:"Recover your account"})}),e.jsx(t.Watermark,{})]})]})}};let D=p.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,K=p.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,L=p(V)`
  ${({$hideAnimations:o})=>o&&W`
      && {
        /* Remove animations because the recoverWallet task on the iframe partially
           blocks the renderer, so the animation stutters and doesn't look good */
        transition: none;
      }
    `}
`;export{re as PasswordRecoveryScreen,re as default};

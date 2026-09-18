import{eX as ee,iD as W,iE as g,dl as p,dm as e,iF as _,eZ as k,iG as A,fx as re,fn as m,iH as te,iI as se,f7 as ne}from"./index-CsujRuQK.js";import{i as E,l as q,t as H,s as Q,y as Y,c as F,n as oe,a as X,d as ie,Q as K,m as ae,g as w,p as N,f as T,v as L,u as j,h as S,b as U}from"./styles-tjTwTW2h-DyQhlE5c.js";import{n as C}from"./ScreenLayout-DTsWfKKs-D1WqMINw.js";import{n as G}from"./styles-DVyDvTdj-R_d5Jl8b.js";import{b as le}from"./ModalFooter-DKyozrEX-DUgK1TQa.js";import{x as de}from"./QrCode-CpGkVlXb-CfwJejCs.js";import{u as ce,a as ue,s as me,b as pe,c as fe,d as he,e as ge,f as ye,g as be,F as xe}from"./floating-ui.react-C3y6E7n-.js";import{p as _e}from"./CopyableText-CQapvaMr-DkuBBBPS.js";import{T as I}from"./triangle-alert-BuY1xdo5.js";import{c as O}from"./createLucideIcon-CR5_yFTU.js";import{C as R}from"./check-yrKiy5yE.js";import{H as ve}from"./hourglass-CKkF-RkJ.js";import{C as Ce}from"./chevron-down-NjeUGGEn.js";import{n as ke,o as Ee,p as we,s as Ne}from"./floating-ui.react-dom-DHNh3Us5.js";import"./Screen-DMmH56yL-B6M8vm1u.js";import"./index-CWARkn2w-BKoogCPy.js";import"./dijkstra-D_NXgYpA.js";import"./copy-MyXFJw2y.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Te=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],je=O("chevron-up",Te);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Se=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],Ue=O("info",Se);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const De=[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]],Ae=O("undo-2",De);class Ie extends p.Component{static getDerivedStateFromError(){return{hasError:!0}}componentDidCatch(t,s){this.props.onError(t)}componentDidUpdate(t){t.resetKey!==this.props.resetKey&&this.state.hasError&&this.setState({hasError:!1})}render(){return this.state.hasError?null:this.props.children}constructor(...t){super(...t),this.state={hasError:!1}}}function Oe(r,t,s){let n=Number(r);return!Number.isFinite(n)||n===0?`1 ${t} ≈ ${r} ${s}`:n>=.01?`1 ${t} ≈ ${$(n)} ${s}`:`${$(1/n)} ${t} ≈ 1 ${s}`}function $(r){return r>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(r)):r>=100?new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(r):r>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(r):new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(r)}function P(r,t){let s=Number(r);if(!Number.isFinite(s)||s===0)return r;let n=t!=null?s/10**t:s;return n>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n):n>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(n):n>=1e-4?new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(n):new Intl.NumberFormat("en-US",{maximumSignificantDigits:4}).format(n)}function D({address:r,caip2:t,config:s}){for(let n of s.currencies){let i=n.chains.find(c=>c.caip2===t&&c.address.toLowerCase()===r.toLowerCase());if(i)return{symbol:n.symbol.toUpperCase(),decimals:i.decimals}}return{symbol:r,decimals:void 0}}function M(r,t){var s;return((s=t[r])==null?void 0:s.displayName)??r}function B(r,t){return r.chains.filter(s=>s.can_be_relay_deposit_source===!0).map(s=>{let n=t.chains[s.caip2];return n?{caip2:s.caip2,displayName:n.displayName,iconUrl:n.iconUrl,vmType:n.vmType,currencyAddress:s.address,currencyDecimals:s.decimals}:null}).filter(s=>s!==null)}function V(r,t){if(!r.chains[t.destinationChain])return`Unsupported destination chain: "${t.destinationChain}". Check that the chain is in CAIP-2 format (e.g. "eip155:8453") and is supported for deposit addresses.`;let s=t.destinationCurrency.toLowerCase();return r.currencies.some(n=>n.chains.some(i=>i.caip2===t.destinationChain&&i.address.toLowerCase()===s))?null:`Unsupported destination currency "${t.destinationCurrency}" on chain "${t.destinationChain}". Check that this token address is supported on the specified chain.`}let Re=new Set(["ROUTE_UNAVAILABLE","UNEXPECTED_STATE","TIMEOUT_WAITING_FOR_NEXT_ORDER","TIMEOUT_ORDER_COMPLETION","DEPOSIT_FAILED","DEPOSIT_REFUNDED","USER_EXITED","AMOUNT_TOO_LOW","INSUFFICIENT_LIQUIDITY","UNSUPPORTED_CHAIN","UNSUPPORTED_CURRENCY","UNSUPPORTED_ROUTE","NO_SWAP_ROUTES_FOUND","NO_INTERNAL_SWAP_ROUTES_FOUND","NO_QUOTES","SANCTIONED_WALLET_ADDRESS","REFUND_WALLET_CREATION_FAILED","DEPOSIT_ADDRESSES_NOT_ENABLED","NOT_AUTHENTICATED"]);function Fe(r){return Re.has(r)}function z(r){return Fe(r)?r:"UNKNOWN_ERROR"}function Z(){let{params:r,setModalState:t}=g(),{privy:s}=k(),n=function(){let{privy:a,refreshSessionAndUser:u}=k();return p.useCallback((d,o)=>o?Promise.resolve({ok:!0,address:o}):A.resolveRefundAddress({privy:a,caip2:d,onWalletCreated:u}),[a,u])}(),[i,c]=p.useState(!1);return{fetchQuote:p.useCallback(async(a,u,d)=>{if(r){c(!0);try{let o=await n(a.caip2,r.refundAddress);if(!o.ok)return void t({step:"error",code:z(o.error)});let l=await s.fetchPrivyRoute(te,{body:{source_chain:a.caip2,source_currency:a.currencyAddress,destination_chain:r.destinationChain,destination_currency:r.destinationCurrency,destination_address:r.destinationAddress,refund_address:o.address,...r.slippageBps!=null?{slippage_bps:r.slippageBps}:{}}});t({step:"address",selectedCurrency:u,selectedChain:a,availableChains:d,quote:l})}catch(o){let l=o instanceof Error?o:Error(String(o)),f="status"in l&&typeof l.status=="number"?l.status:void 0;t({step:"error",code:l instanceof se&&l.code==="feature_not_enabled"?"DEPOSIT_ADDRESSES_NOT_ENABLED":f&&f>=500?"UNKNOWN_ERROR":z(l.message),message:l.message})}finally{c(!1)}}},[r,s,n,t]),isFetching:i}}function J(r,t){switch(r.status){case"completed":return t({step:"complete",order:r});case"refunded":return t({step:"refunded",order:r});case"failed":return t({step:"failed",order:r});case"executing":return t({step:"processing",order:r});default:return}}const Le=({sourceAmount:r,sourceSymbol:t,sourceChainName:s,sourceDecimals:n,destinationAmount:i,destSymbol:c,destChainName:a,destDecimals:u,onClose:d})=>e.jsx(E,{icon:R,iconVariant:"success",title:"Transfer complete",subtitle:i?`Received ${P(r,n)} ${t} on ${s} and converted it to ${P(i,u)} ${c} on ${a}. Funds are available to use.`:`Your ${t} has been received and is now available in your wallet.`,showClose:!0,onClose:d,primaryCta:{label:"Done",onClick:d},watermark:!1});function $e(){let{state:r,configData:t,close:s}=_("complete"),{order:n}=r,{sourceSymbol:i,sourceChainName:c,sourceDecimals:a,destSymbol:u,destChainName:d,destDecimals:o}=p.useMemo(()=>{let l=D({address:n.source_currency,caip2:n.source_chain,config:t}),f=D({address:n.destination_currency,caip2:n.destination_chain,config:t});return{sourceSymbol:l.symbol,sourceChainName:M(n.source_chain,t.chains),sourceDecimals:l.decimals,destSymbol:f.symbol,destChainName:M(n.destination_chain,t.chains),destDecimals:f.decimals}},[n,t]);return e.jsx(Le,{sourceAmount:n.source_amount,sourceSymbol:i,sourceChainName:c,sourceDecimals:a,destinationAmount:n.destination_amount,destSymbol:u,destChainName:d,destDecimals:o,onClose:s})}function Pe(){let{modalState:r,setModalState:t,config:s,retryConfig:n,close:i,createDepositAddressEvent:c}=g();if(r.step!=="error")throw Error("UNEXPECTED_STATE");let{code:a}=r,{title:u,subtitle:d,detail:o,iconVariant:l}=(b=>{switch(b){case"AMOUNT_TOO_LOW":return{title:"Amount too low",subtitle:"The deposit amount is below the minimum for this route.",detail:"Try a larger amount or a different token.",iconVariant:"warning"};case"INSUFFICIENT_LIQUIDITY":return{title:"Insufficient liquidity",subtitle:"There isn't enough liquidity for this route right now.",detail:"Try a smaller amount or a different network.",iconVariant:"warning"};case"UNSUPPORTED_CHAIN":return{title:"Unsupported chain",subtitle:"Deposits from this chain type aren't supported yet. Try a different network.",iconVariant:"warning"};case"UNSUPPORTED_CURRENCY":case"UNSUPPORTED_ROUTE":case"ROUTE_UNAVAILABLE":case"NO_SWAP_ROUTES_FOUND":case"NO_INTERNAL_SWAP_ROUTES_FOUND":case"NO_QUOTES":return{title:"Route not available",subtitle:"This deposit route isn't supported right now. Try a different token or network.",iconVariant:"warning"};case"SANCTIONED_WALLET_ADDRESS":return{title:"Address restricted",subtitle:"This address cannot be used for deposits due to compliance restrictions.",iconVariant:"warning"};case"REFUND_WALLET_CREATION_FAILED":return{title:"Unable to set up refund address",subtitle:"We couldn't create a wallet to receive refunds on this chain. Please try again or select a different network.",iconVariant:"warning"};case"DEPOSIT_ADDRESSES_NOT_ENABLED":return{title:"Not enabled",subtitle:"Deposit addresses are not enabled for this app.",iconVariant:"warning"};case"NOT_AUTHENTICATED":return{title:"Not signed in",subtitle:"Please sign in to continue with your deposit.",iconVariant:"warning"};case"TIMEOUT_WAITING_FOR_NEXT_ORDER":case"TIMEOUT_ORDER_COMPLETION":return{title:"Taking longer than expected",subtitle:"Your funds are safe. The deposit is still being processed — check back later.",iconVariant:"subtle"};default:return{title:"Something went wrong",subtitle:"We couldn't complete your request. Please try again.",iconVariant:"subtle"}}})(a),[f,y]=p.useState(!1);return e.jsx(E,{icon:I,iconVariant:l,title:u,subtitle:o?`${d} ${o}`:d,showClose:!0,onClose:i,primaryCta:{label:"Try again",onClick:async()=>{if(c({eventName:"sdk_deposit_address_action",payload:{action:"retry",step:"error",errorCode:a}}),s.status!=="ready"){y(!0);try{await n(),t({step:"token"})}catch{y(!1)}}else t({step:"token"})},loading:f},watermark:!0})}function Me(){let{state:r,close:t,createDepositAddressEvent:s}=_("failed"),{order:n}=r;return e.jsx(C,{icon:I,iconVariant:"error",title:"Transfer failed",subtitle:"Something went wrong processing your transfer.",showClose:!0,onClose:t,primaryCta:{label:"Done",onClick:t},secondaryCta:{label:"Learn about manual recovery",onClick:()=>{s({eventName:"sdk_deposit_address_action",payload:{action:"link_opened",step:"failed",target:"recovery_docs"}}),window.open("https://docs.privy.io","_blank","noopener,noreferrer")}},watermark:!0,children:e.jsxs(Be,{href:n.tracking_url,target:"_blank",rel:"noopener noreferrer",onClick:()=>{s({eventName:"sdk_deposit_address_action",payload:{action:"link_opened",step:"failed",target:"relay_reference"}})},children:["Reference: ",n.provider_request_id]})})}let Be=m.a`
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.7;
  text-decoration: underline;
  cursor: pointer;
  color: var(--privy-color-foreground-3);
`;function Ve(){let{close:r,setModalState:t,config:s,params:n,onBack:i,createDepositAddressEvent:c}=g(),[a,u]=p.useState(!1);return p.useEffect(()=>{if(a&&n){if(s.status==="ready"){let d=V(s.data,n);t(d?{step:"error",code:"ROUTE_UNAVAILABLE",message:d}:{step:"token"})}s.status==="error"&&t({step:"error",code:"ROUTE_UNAVAILABLE"})}},[a,s,n,t]),e.jsx(E,{icon:K,iconVariant:"subtle",title:"Add funds",subtitle:"Top up your account by sending crypto from any wallet. Conversion and routing handled by Relay.",showClose:!0,onClose:r,showBack:!!i,onBack:i?()=>{c({eventName:"sdk_deposit_address_action",payload:{action:"back",step:"intro"}}),i()}:void 0,primaryCta:{label:"Continue",onClick:()=>{if(c({eventName:"sdk_deposit_address_action",payload:{action:"continue",step:"intro"}}),s.status==="ready"&&n){let d=V(s.data,n);t(d?{step:"error",code:"ROUTE_UNAVAILABLE",message:d}:{step:"token"})}else s.status==="error"?t({step:"error",code:"ROUTE_UNAVAILABLE"}):u(!0)},loading:a&&s.status==="loading",loadingText:null},watermark:!0})}function ze(){let{state:r,setModalState:t,close:s,createDepositAddressEvent:n}=_("network"),[i,c]=p.useState(-1),{availableChains:a}=r,{confirm:u,isFetching:d}=function(){let o=W(),{params:l}=g(),{fetchQuote:f,isFetching:y}=Z();return{confirm:p.useCallback(async b=>{if(!b||!l)return;let h=o==null?void 0:o.modalState;h&&h.step==="network"&&await f(b,h.selectedCurrency,h.availableChains)},[l,o,f]),isFetching:y}}();return e.jsx(C,{title:"Select network",eyebrow:e.jsxs("span",{style:{display:"flex",alignItems:"center",gap:"0.375rem"},children:[e.jsx("img",{src:r.selectedCurrency.logoURI,alt:"",style:{width:"1rem",height:"1rem",borderRadius:"50%"}}),"Send ",r.selectedCurrency.symbol]}),showBack:!0,onBack:()=>{n({eventName:"sdk_deposit_address_action",payload:{action:"back",step:"network"}}),t({step:"token"})},showClose:!0,onClose:s,watermark:!0,children:e.jsx(G,{style:{marginTop:"1rem",height:"22rem"},$colorScheme:"light",children:a.map((o,l)=>e.jsxs(q,{$selected:i===l,disabled:d,onClick:()=>{n({eventName:"sdk_deposit_address_action",payload:{action:"network_selected",step:"network",network:o.caip2}}),c(l),u(o)},children:[e.jsx(H,{src:o.iconUrl,alt:o.displayName}),e.jsx(Q,{children:o.displayName}),d&&l===i&&e.jsx(Y,{})]},o.caip2))})})}const We=({trackingUrl:r,onViewBlockExplorer:t,onClose:s})=>e.jsx(C,{icon:ve,iconVariant:"subtle",title:"Transfer in progress",subtitle:"Your deposit was received and the transfer is now processing.",showClose:!0,onClose:s,secondaryCta:{label:"View on block explorer ↗",onClick:()=>{t(),window.open(r,"_blank","noopener,noreferrer")}},watermark:!1,children:e.jsxs(ae,{children:[e.jsxs(w,{children:[e.jsx(N,{$status:"done",children:e.jsx(R,{size:14,color:"var(--privy-color-icon-success)",strokeWidth:2})}),e.jsx(T,{children:"Deposit received"})]}),e.jsx(L,{}),e.jsxs(w,{children:[e.jsx(N,{$status:"active",children:e.jsx(qe,{})}),e.jsx(T,{children:"Bridging"})]}),e.jsx(L,{}),e.jsxs(w,{children:[e.jsx(N,{$status:"pending"}),e.jsx(T,{children:"Funds arrived"})]})]})});let qe=m.span`
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--privy-color-foreground-3);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;function He(){let{state:r,close:t,createDepositAddressEvent:s}=_("processing");return function({orderId:n,enabled:i}){let{privy:c}=k(),{setModalState:a}=g();p.useEffect(()=>{let u=new AbortController;return A.waitForCompletion({privy:c,orderId:n,signal:u.signal}).then(d=>{u.signal.aborted||(d.status==="success"?J(d.order,a):d.status==="timeout"&&a({step:"error",code:"TIMEOUT_ORDER_COMPLETION"}))}),()=>{u.abort()}},[i,n,c,a])}({orderId:r.order.id,enabled:!0}),e.jsx(We,{trackingUrl:r.order.tracking_url,onViewBlockExplorer:()=>{s({eventName:"sdk_deposit_address_action",payload:{action:"link_opened",step:"processing",target:"block_explorer"}})},onClose:t})}function Qe(){let{state:r,close:t,createDepositAddressEvent:s}=_("refunded"),{order:n}=r;return e.jsx(E,{icon:Ae,iconVariant:"subtle",title:"Transfer refunded",subtitle:"Your transfer was received, but the swap couldn't be completed. A refund has been started automatically.",showClose:!0,onClose:t,primaryCta:{label:"Done",onClick:t},secondaryCta:{label:"View transaction details",onClick:()=>{s({eventName:"sdk_deposit_address_action",payload:{action:"link_opened",step:"refunded",target:"transaction_details"}}),window.open(n.tracking_url,"_blank","noopener,noreferrer")}},watermark:!0})}function Ye(){let{close:r,setModalState:t,config:s,createDepositAddressEvent:n}=g(),{confirm:i,currencies:c,isFetching:a}=function(){let{config:o,setModalState:l}=g(),{fetchQuote:f,isFetching:y}=Z(),b=o.status==="ready"?o.data.currencies.filter(h=>B(h,o.data).length>0):[];return{confirm:p.useCallback(async h=>{if(o.status!=="ready"||!h)return;let x=B(h,o.data);if(x.length!==1)l({step:"network",selectedCurrency:h,availableChains:x});else{let v=x[0];await f(v,h,x)}},[o,f,l]),currencies:b,isFetching:y}}(),[u,d]=p.useState(-1);return e.jsx(C,{title:"Select token",subtitle:"Choose the asset you'll send.",showBack:!0,onBack:()=>{n({eventName:"sdk_deposit_address_action",payload:{action:"back",step:"token"}}),t({step:"intro"})},showClose:!0,onClose:r,watermark:!0,children:s.status==="error"?e.jsx(F,{children:e.jsx(oe,{children:"Failed to load tokens"})}):s.status==="loading"?e.jsx(F,{children:e.jsx(re,{})}):e.jsx(G,{style:{marginTop:"1rem",height:"22rem"},$colorScheme:"light",children:c.map((o,l)=>e.jsxs(q,{$selected:u===l,disabled:a,onClick:()=>{n({eventName:"sdk_deposit_address_action",payload:{action:"token_selected",step:"token",token:o.symbol}}),d(l),i(o)},children:[e.jsx(X,{src:o.logoURI,alt:o.symbol}),e.jsx(Q,{children:o.name}),a&&l===u?e.jsx(Y,{}):e.jsx(ie,{children:o.symbol})]},o.symbol))})})}function Xe({address:r,onClick:t}){let[s,n]=p.useState(!1);return e.jsx(e.Fragment,{children:s?e.jsx(Ke,{onClick:()=>n(!1),style:{marginTop:"1.5rem"},children:e.jsx(de,{url:r,size:312,hideLogo:!0})}):e.jsxs(Ge,{title:"Click to copy address",onClick:t,style:{marginTop:"1.5rem"},children:[e.jsxs(Ze,{children:[e.jsx(Je,{children:"Deposit address"}),e.jsx(er,{children:r})]}),e.jsx(rr,{children:e.jsx(tr,{type:"button",onClick:i=>{i.stopPropagation(),n(!0)},children:e.jsx(K,{size:16,color:"var(--privy-color-icon-muted)"})})})]})})}let Ke=m.div`
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
`,Ge=m.div`
  display: flex;
  border-radius: var(--privy-border-radius-md);
  background: var(--privy-color-background-clicked);
  padding: 1rem;
  cursor: pointer;
  gap: 0.5rem;
`,Ze=m.div`
  flex: 1;
  min-width: 0;
  text-align: left;
`,Je=m.div`
  font-size: 0.75rem;
  color: var(--privy-color-icon-muted);
  line-height: 1rem;
  margin-bottom: 0.25rem;
`,er=m.div`
  word-break: break-all;
  font-size: 0.875rem;
  font-family: ui-monospace, monospace;
  font-weight: 500;
  line-height: 1.375rem;
  color: var(--privy-color-foreground);
`,rr=m.div`
  width: 1.5rem;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
`,tr=m.button`
  && {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
    box-shadow: none;
    border-radius: var(--privy-border-radius-xs);

    &:hover {
      background: var(--privy-color-background);
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`;function sr({quote:r,selectedCurrency:t,selectedChain:s,destinationSymbol:n}){let[i,c]=p.useState(!1),a=t.symbol.toUpperCase(),u=s.displayName,d=p.useRef(null);return e.jsxs(nr,{children:[e.jsxs(or,{onClick:p.useCallback(()=>{let o=document.getElementById("privy-modal-content");o&&(d.current&&clearTimeout(d.current),o.style.transition="none",d.current=setTimeout(()=>{o.style.transition="",d.current=null},160)),c(l=>!l)},[]),children:[e.jsxs(ir,{children:[t.logoURI&&e.jsx(X,{src:t.logoURI,alt:a,style:{width:"2rem",height:"2rem"}}),s.iconUrl&&e.jsx(ar,{src:s.iconUrl,alt:u})]}),e.jsxs(lr,{children:[e.jsx(dr,{children:"You send"}),e.jsxs(cr,{children:[a," on ",u]})]}),e.jsx(ur,{children:e.jsx(i?je:Ce,{size:16})})]}),e.jsx(hr,{$expanded:i,children:e.jsx(gr,{children:e.jsxs(mr,{children:[r.indicative_rate&&e.jsxs(j,{children:[e.jsx(S,{children:"Conversion rate"}),e.jsxs(U,{style:{display:"flex",alignItems:"center",gap:"0.25rem"},children:[Oe(r.indicative_rate,a,n.toUpperCase()),e.jsx(yr,{content:"Estimated rate based on current market conditions. Final execution price may vary depending on transfer size and routing."})]})]}),e.jsxs(j,{children:[e.jsx(S,{children:"Max slippage"}),e.jsxs(U,{children:[(r.slippage_bps/100).toFixed(1),"%"]})]}),e.jsxs(j,{children:[e.jsx(S,{children:"Refund address"}),e.jsx(U,{children:e.jsx(_e,{value:r.refund_address,iconOnly:!0,iconSize:11,children:ne(r.refund_address,4,4)})})]})]})})}),e.jsxs(pr,{children:[e.jsx(I,{size:16,color:"var(--privy-color-icon-muted)",style:{flexShrink:0}}),e.jsxs(fr,{children:["Only send ",e.jsx("strong",{children:a})," on ",e.jsx("strong",{children:u}),". Other assets may be lost."]})]})]})}let nr=m.div`
  border-radius: var(--privy-border-radius-md);
  border: 1px solid var(--privy-color-foreground-4);
  overflow: hidden;
`,or=m.button`
  && {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--privy-color-foreground);
    outline: none;
    box-shadow: none;

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,ir=m.span`
  position: relative;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
`,ar=m(H)`
  && {
    position: absolute;
    top: -0.125rem;
    right: -0.25rem;
    width: 0.75rem;
    height: 0.75rem;
    box-sizing: content-box;
    border: 1.5px solid var(--privy-color-background);
    background-color: var(--privy-color-background);
  }
`,lr=m.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,dr=m.span`
  font-size: 0.75rem;
  color: var(--privy-color-foreground-3);
  line-height: 1rem;
`,cr=m.span`
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
`,ur=m.span`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-clicked);
  color: var(--privy-color-foreground-3);
`,mr=m.div`
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.75rem;

  & > * {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--privy-color-foreground-4);
  }

  & > *:last-child {
    border-bottom: none;
  }
`,pr=m.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.75rem 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--privy-border-radius-sm);
  background: var(--privy-color-background-2);
`,fr=m.span`
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--privy-color-icon-muted);
  text-align: left;
`,hr=m.div`
  display: grid;
  grid-template-rows: ${({$expanded:r})=>r?"1fr":"0fr"};
  transition: grid-template-rows 150ms ease-out;
`,gr=m.div`
  overflow: hidden;
`;function yr({content:r}){let[t,s]=p.useState(!1),{refs:n,floatingStyles:i,context:c}=ce({open:t,onOpenChange:s,placement:"top",whileElementsMounted:ke,middleware:[Ee(6),we(),Ne({padding:8})]}),a=ue(c,{move:!1,handleClose:me()}),u=pe(c),{getReferenceProps:d,getFloatingProps:o}=fe([a,u,he(c),ge(c),ye(c,{role:"tooltip"})]),{isMounted:l,styles:f}=be(c,{duration:150});return e.jsxs(e.Fragment,{children:[e.jsx("button",{ref:n.setReference,type:"button","aria-label":"More information about conversion rate",style:{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0,border:"none",background:"none",color:"var(--privy-color-icon-muted)",cursor:"pointer"},...d(),children:e.jsx(Ue,{size:14})}),l&&e.jsx(xe,{root:document.getElementById("privy-modal-content")??void 0,children:e.jsx(br,{ref:n.setFloating,style:{...i,...f},...o(),children:r})})]})}let br=m.div`
  max-width: 13rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--privy-border-radius-sm, 0.375rem);
  background: var(--privy-color-foreground);
  color: var(--privy-color-background);
  font-size: 0.6875rem;
  line-height: 1rem;
  font-weight: 400;
  text-align: left;
  z-index: 10;
`;const xr=({quote:r,selectedCurrency:t,selectedChain:s,destinationSymbol:n,onBack:i,onClose:c})=>{var f;let[a,u]=p.useState(!1),d=((f=t==null?void 0:t.symbol)==null?void 0:f.toUpperCase())??"funds",o=(s==null?void 0:s.displayName)??"",l=async()=>{a||(await navigator.clipboard.writeText(r.deposit_address),u(!0),setTimeout(()=>u(!1),2e3))};return e.jsxs(C,{title:`Send ${d}${o?` on ${o}`:""}`,subtitle:"Send funds to the address below. Conversion and routing handled by Relay.",showBack:!0,onBack:i,showClose:!0,onClose:c,watermark:!1,children:[e.jsx(sr,{quote:r,selectedCurrency:t,selectedChain:s,destinationSymbol:n}),e.jsx(Xe,{address:r.deposit_address,onClick:l}),e.jsx(le,{style:{marginTop:"1rem",marginBottom:"0.5rem",...a?{backgroundColor:"var(--privy-color-icon-success)",borderColor:"var(--privy-color-icon-success)"}:{}},onClick:l,children:a?e.jsxs(e.Fragment,{children:["Copied ",e.jsx(R,{size:16,style:{marginLeft:"0.25rem"}})]}):"Copy address"}),e.jsx(_r,{children:"Routing and bridging are handled by Relay. Privy does not control execution timing, liquidity, or transaction outcomes."})]})};let _r=m.p`
  && {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    line-height: 1.125rem;
    color: var(--privy-color-icon-muted);
    text-align: center;
  }
`;function vr(){let{state:r,configData:t,setModalState:s,close:n,params:i,createDepositAddressEvent:c}=_("address"),{quote:a,selectedCurrency:u,selectedChain:d,availableChains:o}=r;return function({depositAddressId:l,enabled:f,quoteCreatedAt:y}){let{privy:b}=k(),{setModalState:h}=g();p.useEffect(()=>{if(!l)return;let x=new AbortController;return A.waitForDeposit({privy:b,depositAddressId:l,quoteCreatedAt:y,signal:x.signal}).then(v=>{x.signal.aborted||(v.status==="success"?J(v.order,h):v.status==="timeout"&&h({step:"error",code:"TIMEOUT_WAITING_FOR_NEXT_ORDER"}))}),()=>{x.abort()}},[f,l,b,y,h])}({depositAddressId:a.id,enabled:!0,quoteCreatedAt:a.created_at}),e.jsx(xr,{quote:a,selectedCurrency:u,selectedChain:d,destinationSymbol:p.useMemo(()=>D({address:i.destinationCurrency,caip2:i.destinationChain,config:t}).symbol,[i,t]),onBack:()=>{c({eventName:"sdk_deposit_address_action",payload:{action:"back",step:"address"}}),s({step:"network",selectedCurrency:u,availableChains:o})},onClose:n})}function Cr(){let{modalState:r,setModalState:t}=g();return e.jsx(Ie,{onError:s=>t({step:"error",code:"UNEXPECTED_STATE",message:s.message}),resetKey:r.step,children:e.jsx(kr,{})})}function kr(){let{modalState:r}=g();switch(r.step){case"intro":return e.jsx(Ve,{});case"token":return e.jsx(Ye,{});case"network":return e.jsx(ze,{});case"address":return e.jsx(vr,{});case"processing":return e.jsx(He,{});case"complete":return e.jsx($e,{});case"refunded":return e.jsx(Qe,{});case"failed":return e.jsx(Me,{});case"error":return e.jsx(Pe,{});default:return null}}var Vr={component:()=>{let{onUserCloseViaDialogOrKeybindRef:r}=ee(),t=W(),{close:s,config:n}=g();return p.useEffect(()=>{r.current=s},[r,s]),p.useEffect(()=>{if(n.status==="ready"){for(let i of n.data.currencies)new Image().src=i.logoURI;for(let i of Object.values(n.data.chains))new Image().src=i.iconUrl}},[n]),t?e.jsx(Cr,{}):null}};export{Vr as default};

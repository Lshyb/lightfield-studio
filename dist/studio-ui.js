import { hairCuts } from './hair-cuts.js';
import { hairPreviews } from './hair-previews.js';
import {localHairPreviewCache} from './hair-preview-cache.js';
const $ = s => document.querySelector(s);
export function setupStudioUI() {
  document.body.classList.add('studio-refined');
  $('.trial-banner')?.remove();
  $('.page-heading .eyebrow').textContent='PORTRAIT LIGHTING / STUDIO 01';
  $('.page-heading h1').innerHTML='人像布光工作室<span>。</span>';
  $('.page-heading p').textContent='调整灯位，观察阴影。把每一束光，变成你的表达。';
  const lighting=$('.lighting-panel'), left=document.createElement('div');
  left.className='light-column'; lighting.before(left); left.append(lighting);
  const drawer=document.createElement('details'); drawer.className='diagram-drawer panel';
  drawer.innerHTML='<summary>灯位图 <span>TOP VIEW ↗</span></summary>';
  drawer.append($('.diagram-panel'));left.append(drawer);

  const panel=$('.camera-panel');
  panel.querySelector('.panel-title h2').textContent='人物与相机';
  panel.querySelector('.panel-title>span').textContent='SETTINGS';
  const tabs=document.createElement('div');tabs.className='settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','人物与相机设置');
  tabs.innerHTML=['人物','相机','场景'].map((name,i)=>`<button id="settingTab-${i}" role="tab" aria-selected="${i===0}" aria-controls="settingPane-${i}" tabindex="${i===0?0:-1}" data-setting="${i}">${name}</button>`).join('');
  panel.append(tabs);
  const panes=[0,1,2].map(i=>{const node=document.createElement('div');node.className='settings-pane';node.id=`settingPane-${i}`;node.setAttribute('role','tabpanel');node.setAttribute('aria-labelledby',`settingTab-${i}`);node.hidden=i!==0;panel.append(node);return node;});
  panes[0].append($('.subject-picker'),$('.hair-settings'),$('.pose-control'));
  panes[1].append($('.camera-settings'));
  /* Camera controls and their limitations are provided by camera-ui.js. */
  panel.querySelectorAll('.scene-options').forEach(node=>panes[2].append(node));
  function selectTab(index,focus=false){tabs.querySelectorAll('button').forEach((button,i)=>{button.setAttribute('aria-selected',i===index);button.tabIndex=i===index?0:-1;panes[i].hidden=i!==index;});if(focus)tabs.children[index].focus();}
  tabs.addEventListener('click',event=>{const button=event.target.closest('[data-setting]');if(button)selectTab(+button.dataset.setting);});
  tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=+event.target.dataset.setting;selectTab(event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3,true);});

  const select=$('#hairStyle');select.hidden=true;select.tabIndex=-1;
  const cards=document.createElement('div');cards.className='hair-cards';cards.setAttribute('role','group');cards.setAttribute('aria-label','选择发型');
  select.after(cards);
  cards.addEventListener('click',event=>{const button=event.target.closest('[data-hair-card]');if(button){select.value=button.dataset.hairCard;select.dispatchEvent(new Event('change',{bubbles:true}));generatePreviews();}});
  const hairHeading=$('.hair-settings h3');
  let subject='';
  let storage;try{storage=localStorage;}catch{}
  const cache=localHairPreviewCache(storage);let previewProvider,previewJob;
  function displayImage(id,url){
    if(subject!=='female')return;
    const slot=cards.querySelector(`[data-hair-card="${id}"] .hair-card-image`);
    if(!slot)return;
    const img=new Image(240,300);img.alt=`女性${hairCuts.female[id].name}效果`;img.src=url;
    slot.querySelector('img,.hair-live-placeholder')?.replaceWith(img);
  }
  function generatePreviews(){
    if(subject!=='female'||!previewProvider||previewJob||!cache.missing().length)return;
    previewJob=previewProvider(cache.missing(),(id,image)=>{cache.save(id,image);displayImage(id,image);})
      .catch(()=>{if(subject==='female')cards.querySelectorAll('.hair-live-placeholder small').forEach(e=>e.textContent='生成未完成 · 点击重试');})
      .finally(()=>{previewJob=undefined;});
  }
  return {setPreviewProvider(provider){previewProvider=provider;generatePreviews();},sync(state){
    const hairSet=hairCuts[state.subject];
    if(subject!==state.subject){
      subject=state.subject;const sex=subject==='female'?'女性':'男性';
      cards.dataset.subject=subject;cards.setAttribute('aria-label',`${sex}发型对照`);hairHeading.textContent=`发型对照 · ${sex}`;
      // Replace all four nodes together, so a previously decoded portrait can
      // never remain visible while the other subject's picture is loading.
      cards.innerHTML=Object.entries(hairSet).map(([id,{name}],i)=>{
          const picture=(subject==='female'&&cache.get(id))||hairPreviews[subject][id];
          const image=picture?`<img src="${picture}" alt="${sex}${name}效果" width="240" height="300">`:`<span class="hair-live-placeholder"><strong>${String(i+1).padStart(2,'0')}</strong><small>正在渲染发型照片…</small></span>`;
          return `<button type="button" data-hair-card="${id}" data-subject="${subject}" aria-label="${sex} · ${name}" aria-pressed="false"><span class="hair-card-image">${image}<i>${String(i+1).padStart(2,'0')}</i></span><span class="hair-card-label">${name}<b>✓</b></span></button>`;
        }).join('');
      Object.entries(hairSet).forEach(([id,{name}])=>select.querySelector(`option[value="${id}"]`).textContent=name);
    }
    cards.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',button.dataset.hairCard===state.hair.style));
    generatePreviews();
  }};
}

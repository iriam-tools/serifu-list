'use strict';
const KEY='serifu-note.v1';
const base=window.SERIFU_BASE;
const clone=value=>JSON.parse(JSON.stringify(value));
const $=id=>document.getElementById(id);
let groups=clone(base),active=base[0].key,editing=null,storageBlocked=false;
function valid(data){
 return data&&data.version===1&&Array.isArray(data.groups)&&data.groups.length===base.length&&base.every(b=>{
  const g=data.groups.find(g=>g&&g.key===b.key);
  return g&&Array.isArray(g.items)&&g.items.length>0&&g.items.length<=10000&&new Set(g.items.map(i=>i.id)).size===g.items.length&&g.items.every(i=>Number.isSafeInteger(i.id)&&i.id>0&&i.id<1000000&&typeof i.text==='string'&&i.text.trim().length>0&&i.text.length<=10000);
 });
}
function normalize(data){return base.map(b=>({...clone(b),items:data.groups.find(g=>g.key===b.key).items.map(i=>({id:i.id,text:i.text})).sort((a,b)=>a.id-b.id)}))}
function error(message){$('error').textContent=message;$('error').hidden=!message}
try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(!valid(data))throw Error('format');groups=normalize(data)}}catch(e){storageBlocked=true;error('保存データを読み込めませんでした。元データの上書きを避けるため自動保存を止めています。書き出しで保管するか、正常なバックアップを読み込んでください。')}
function payload(){return {version:1,groups:clone(groups)}}
function persist(){
 if(storageBlocked){$('status').textContent='未保存・書き出しできます';return}
 try{localStorage.setItem(KEY,JSON.stringify(payload()));$('status').textContent='このブラウザに保存済み';error('')}
 catch(e){$('status').textContent='未保存・書き出しできます';error('ブラウザに保存できません。編集内容を失わないよう「データを書き出す」で保管してください。')}
}
function current(){return groups.find(g=>g.key===active)}
function render(){
 const g=current();$('categories').replaceChildren();
 for(const group of groups){const button=document.createElement('button');button.type='button';button.setAttribute('aria-current',String(group.key===active));button.append(document.createTextNode(group.name));const count=document.createElement('span');count.textContent=group.items.length+'件';button.append(count);button.onclick=()=>{active=group.key;$('search').value='';render()};$('categories').append(button)}
 $('group-title').textContent=g.name;$('count').textContent=g.items.length+'件';$('prefix').textContent='呼びかけのメモ：'+g.prefix;
 const q=$('search').value.trim().toLocaleLowerCase();const items=g.items.filter(i=>i.text.toLocaleLowerCase().includes(q)||String(i.id).includes(q));
 $('list').replaceChildren();
 for(const item of items){const row=document.createElement('article');const number=document.createElement('span');number.className='number';number.textContent=String(item.id).padStart(3,'0');const body=document.createElement('div');const text=document.createElement('p');text.className='line';text.textContent=item.text;body.append(text);const original=base.find(b=>b.key===active).items.find(i=>i.id===item.id);if(!original||original.text!==item.text){const badge=document.createElement('span');badge.className='badge';badge.textContent=original?'編集済み':'追加したセリフ';body.append(badge)}const edit=document.createElement('button');edit.className='edit';edit.textContent='編集';edit.setAttribute('aria-label',item.id+'番のセリフを編集');edit.onclick=()=>openEditor(item);row.append(number,body,edit);$('list').append(row)}
 $('empty').hidden=items.length!==0;$('shown').textContent=items.length+' / '+g.items.length+'件を表示';
}
function openEditor(item){editing=item?item.id:null;$('edit-title').textContent=item?current().name+'・'+item.id+'番を編集':current().name+'にセリフを追加';$('text').value=item?item.text:'';$('text').setCustomValidity('');$('editor').showModal();$('text').focus()}
$('text').oninput=()=>$('text').setCustomValidity('');
$('search').oninput=render;$('add').onclick=()=>openEditor(null);$('close').onclick=$('cancel').onclick=()=>$('editor').close();
$('edit-form').onsubmit=event=>{event.preventDefault();const text=$('text').value.trim();if(!text){$('text').setCustomValidity('セリフを入力してください。');$('text').reportValidity();return}const g=current();if(editing===null){if(g.items.length>=10000){error('追加できる上限は1種類につき10,000件です。');$('editor').close();return}const id=Math.max(...g.items.map(i=>i.id))+1;if(id>=1000000){error('番号の上限に達しました。');$('editor').close();return}g.items.push({id,text});$('search').value=''}else{g.items.find(i=>i.id===editing).text=text}persist();render();$('editor').close();if(editing===null)$('list').lastElementChild?.scrollIntoView({block:'center',behavior:'smooth'})};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='serifu-note-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error();const data=JSON.parse(await file.text());if(!valid(data))throw Error();if(!confirm('2種類のセリフ帳を、このファイルの内容で置き換えます。現在の編集を残す場合はキャンセルして先に書き出してください。'))return;groups=normalize(data);storageBlocked=false;$('search').value='';persist();render()}catch(e){error('読み込めませんでした。このセリフ帳から書き出したJSONファイルを選んでください。現在のデータは変更していません。')}finally{$('file').value=''}};
$('reset').onclick=()=>{if(!confirm(current().name+'を原本の100件に戻します。この種類の編集・追加は取り消されます。'))return;groups=groups.map(g=>g.key===active?clone(base.find(b=>b.key===active)):g);$('search').value='';persist();render()};
window.addEventListener('storage',event=>{if(event.key===KEY){storageBlocked=true;error('別のタブで保存内容が変わりました。この画面の自動保存を停止しています。編集中の内容を書き出してからページを再読み込みしてください。');$('status').textContent='自動保存を停止中'}});
$('status').textContent=storageBlocked?'自動保存を停止中':'このブラウザに自動保存';render();

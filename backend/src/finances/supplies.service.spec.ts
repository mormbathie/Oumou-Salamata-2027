jest.mock('../auth/guards/jwt-auth.guard',()=>({JwtAuthGuard:class {}}));
import 'reflect-metadata';
import { SuppliesService, legacySupplies } from './supplies.service';
import { SuppliesController } from './supplies.controller';
import { schoolFees, registrationAdjustment, registrationSnapshot } from '../school/school-options';

describe('Independent supplies billing',()=>{
 const actor={userId:'admin',username:'Admin',roles:['ADMIN']};
 const classroom={program:'ELEMENTARY',level:'CI',registrationFee:40000,monthlyTuition:15000};
 it('never adds supplies to new registrations and marks their pricing policy',()=>{
  expect(schoolFees({supplies:true},classroom).registrationFee).toBe(40000);
  expect(JSON.parse(registrationSnapshot({supplies:true}))).toMatchObject({suppliesSeparate:true,supplies:true});
 });
 it('does not remove old supplies when toggled or when another option changes',()=>{
  const invoice={amount:77500,registrationOptions:JSON.stringify({supplies:true})};
  expect(registrationAdjustment({supplies:true},{supplies:false},classroom,classroom,invoice).delta).toBe(0);
  const adjusted=registrationAdjustment({supplies:true},{supplies:false,fullDay:true},classroom,classroom,invoice);
  expect(adjusted.delta).toBe(25000);expect(JSON.parse(adjusted.registrationOptions).supplies).toBe(true);
 });
 it('flags unknown historic amounts without inferring a paid supply allocation',()=>{
  expect(legacySupplies({registrationOptions:null},false)).toBe(true);
  expect(legacySupplies({registrationOptions:'broken'},false)).toBe(true);
  expect(legacySupplies({registrationOptions:'{"supplies":true}'},false)).toBe(true);
  expect(legacySupplies({registrationOptions:'{"supplies":false}'},false)).toBe(false);
  expect(legacySupplies({registrationOptions:'{"suppliesSeparate":true,"supplies":true}'},true)).toBe(false);
 });
 it('keeps the review flag when another option changes on an unknown legacy invoice',()=>{
  const changed=registrationAdjustment({},{karate:true},classroom,classroom,{amount:100000});
  expect(JSON.parse(changed.registrationOptions).suppliesLegacyReview).toBe(true);
  expect(legacySupplies({registrationOptions:changed.registrationOptions},false)).toBe(true);
 });
 it('limits catalogue writes to admin/director and sales to financial staff',()=>{
  expect(Reflect.getMetadata('roles',SuppliesController.prototype.create)).toEqual(['ADMIN','DIRECTEUR']);
  expect(Reflect.getMetadata('roles',SuppliesController.prototype.update)).toEqual(['ADMIN','DIRECTEUR']);
  expect(Reflect.getMetadata('roles',SuppliesController.prototype.sell)).toEqual(['ADMIN','DIRECTEUR','COMPTABLE']);
 });
 it('rejects invalid prices, quantities, duplicate articles and spoofed catalogue prices before writing',async()=>{
  const db:any={$transaction:jest.fn()};const service=new SuppliesService(db);
  for(const data of [{name:'Livre',price:0},{name:'Livre',price:1.5},{name:' ',price:100},{name:'Livre',price:500,active:'true'}])await expect(service.saveArticle(data,actor)).rejects.toThrow();
  for(const lines of [[{articleId:'a',quantity:0,unitPrice:100}],[{articleId:'a',quantity:1.5,unitPrice:100}],[{articleId:'a',quantity:1,unitPrice:-10}],[{articleId:'a',quantity:1,unitPrice:100},{articleId:'a',quantity:1,unitPrice:100}]])await expect(service.sell({studentId:'s',requestKey:'1234567890123456',lines},actor)).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
 });
});

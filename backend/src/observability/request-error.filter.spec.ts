import { Prisma } from '@prisma/client';
import { RequestErrorFilter } from './request-error.filter';
describe('Safe database error diagnostics', () => {
 it('logs the Prisma code and schema field without SQL or failed values', () => {
  const response:any = {locals:{},status:jest.fn().mockReturnThis(),json:jest.fn()};
  const error=new Prisma.PrismaClientKnownRequestError('SECRET SQL personal value', {code:'P2002',clientVersion:'6',meta:{target:['invoiceNumber','unsafe value secret']}});
  new RequestErrorFilter().catch(error,{switchToHttp:()=>({getResponse:()=>response})} as any);
  expect(response.locals.errorCode).toBe('P2002');expect(response.locals.errorFields).toEqual(['invoiceNumber']);
  expect(response.locals.errorHint).toContain('doublon');expect(JSON.stringify(response.locals)).not.toContain('SECRET SQL');
  expect(response.json).toHaveBeenCalledWith({statusCode:500,message:'Internal server error'});
 });
});

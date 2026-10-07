import { EventEmitter } from 'node:events';
import { requestLog, safeInputs } from './request-log';

describe('Request observability', () => {
  it('keeps business fields and masks secrets and personal data recursively', () => {
    expect(safeInputs({ amount: 200, password: 'private', currentPassword: 'private', email: 'private', name: { token: 'private', id: '123' }, file: 'private' })).toEqual({ amount: 200, password: '[redacted]', currentPassword: '[redacted]', email: '[redacted]', name: { token: '[redacted]', id: '123' }, file: '[redacted]' });
  });
  it('logs one failed request with account, response code and masked inputs', () => {
    const logger = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = Object.assign(new EventEmitter(), { locals: {}, statusCode: 400, writableFinished: true, setHeader: jest.fn(), json: jest.fn() });
    const req = { method: 'POST', path: '/api/classes', route: { path: '/api/classes' }, headers: { 'user-agent': 'Mozilla Android Mobile Chrome/123' }, ip: '127.0.0.1', body: { capacity: -1, password: 'private' }, query: {}, params: {}, user: { userId: 'actor-1', username: 'admin', roles: ['ADMIN'] } };
    requestLog(req as any, res as any, jest.fn());
    res.json({ message: 'capacity must be positive' });
    res.emit('finish'); res.emit('close');
    expect(logger).toHaveBeenCalledTimes(1);
    const event = JSON.parse(logger.mock.calls[0][0]);
    expect(event).toMatchObject({ status_code: 400, account: { id: 'actor-1' }, device: { type: 'mobile' }, error: { message: 'capacity must be positive' }, input: { body: { capacity: -1, password: '[redacted]' } } });
    expect(event.status_class).toBe('4xx');expect(event.aborted).toBe(false);
    expect(event.correlation_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', event.correlation_id);
    logger.mockRestore();
  });
  it('logs aborted connections once without authentication payloads', () => {
    const logger = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = Object.assign(new EventEmitter(), { locals: {}, statusCode: 200, writableFinished: false, setHeader: jest.fn(), json: jest.fn() });
    requestLog({ method: 'POST', path: '/api/auth/login', headers: {}, body: { password: 'private' }, ip: '127.0.0.1' } as any, res as any, jest.fn());
    res.emit('close');res.emit('finish');
    const event = JSON.parse(logger.mock.calls[0][0]);
    expect(event.status_code).toBe(499);expect(event.input).toBe('[redacted]');expect(logger).toHaveBeenCalledTimes(1);
    logger.mockRestore();
  });
  it('records bounded success context without body contents or sensitive query values', () => {
    const logger = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = Object.assign(new EventEmitter(), {locals:{},statusCode:201,writableFinished:true,setHeader:jest.fn(),json:jest.fn(),getHeader:()=> '120'});
    requestLog({method:'POST',path:'/api/students',route:{path:'/api/students'},headers:{'content-type':'application/json','content-length':'300'},ip:'127.0.0.1',body:{firstName:'Private'},params:{id:'record'},query:{page:'1',email:'Private'}} as any,res as any,jest.fn());
    res.emit('finish');
    const event=JSON.parse(logger.mock.calls[0][0]);
    expect(event).toMatchObject({status_class:'2xx',request_bytes:300,response_bytes:120,request_context:{params:{id:'record'},query:{page:'1',email:'[redacted]'}}});
    expect(event.input).toBeUndefined();expect(JSON.stringify(event)).not.toContain('Private');logger.mockRestore();
  });

});

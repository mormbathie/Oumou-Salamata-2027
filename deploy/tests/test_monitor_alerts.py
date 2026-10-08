import importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('monitor',Path(__file__).parents[1]/'observability/monitor-alerts.py')
monitor=importlib.util.module_from_spec(spec);spec.loader.exec_module(monitor)

class MonitoringTests(unittest.TestCase):
    def test_alert_cooldown_and_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'state.json'
            with patch.object(monitor,'STATE',path),patch.object(monitor.os,'geteuid',return_value=0),patch.object(monitor,'check',return_value=['API indisponible']),patch.object(monitor,'email') as send,patch.object(monitor.time,'time',return_value=10000):
                monitor.main();monitor.main()
                self.assertEqual(send.call_count,1)
                with patch.object(monitor.time,'time',return_value=14000):monitor.main()
                self.assertEqual(send.call_count,2)
                with patch.object(monitor,'check',return_value=[]):monitor.main()
                self.assertEqual(send.call_count,3)
                self.assertIn('rétablis',send.call_args.args[0])
                self.assertEqual(json.loads(path.read_text())['issues'],[])
    def test_nested_signoz_results_count_errors(self):
        payload={'data': {'data': {'results': [{'aggregations': [{'series': [
            {'labels': {'status_class': '2xx'}, 'values': [{'value': 20}]},
            {'labels': {'status_class': '5xx'}, 'values': [{'value': 3}]},
        ]}]}]}}}
        from unittest.mock import mock_open
        with patch.object(Path,'read_text',return_value='{"email":"fixture","password":"fixture","orgId":"fixture"}'),patch.object(monitor,'request',side_effect=[{'data':{'accessToken':'fixture'}},payload]):
            self.assertEqual(monitor.recent_errors(),(23,3))

    def test_failed_delivery_does_not_mark_alert_as_sent(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'state.json'
            with patch.object(monitor,'STATE',path),patch.object(monitor.os,'geteuid',return_value=0),patch.object(monitor,'check',return_value=['API indisponible']),patch.object(monitor,'email',side_effect=RuntimeError('SMTP failed')):
                with self.assertRaises(RuntimeError):monitor.main()
                self.assertFalse(path.exists())

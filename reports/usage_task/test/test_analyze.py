"""사용 과제 분석 시험(pytest 없이 실행): python3 reports/usage_task/test/test_analyze.py

1) 합성 자료(synth_usage.py) → analyze_usage
   - --draft 없으면 거절(종료 코드 2)하고 아무것도 쓰지 않음, --draft 면 followup.json 의 usage 만 바꿈
   - 참가자별 정답 수·시간·판단 쉬움 = 생성한 값(재응답·시험·동의 안 함은 빠짐)
   - tidy CSV = 원 응답 시트 CSV = get_values JSON
2) 본 결과(final) 보호, 유효 0명 거절, 시트 점수와 정답 키가 다르면 오류
3) 통계(정확 부호 검정·윌콕슨 정확 분포)를 손으로 센 값과 대조, 조사·날짜·타임스탬프 처리
"""
import copy
import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))

import analyze_usage as au      # noqa: E402
import synth_usage              # noqa: E402

PASSED = []
LOCK = au.load_lock()


def ok(cond, msg):
    if not cond:
        raise AssertionError(msg)
    PASSED.append(msg)


def cli(*args):
    return subprocess.run([sys.executable, str(HERE / 'analyze_usage.py'), *map(str, args)], capture_output=True, text=True)


def read_csv(p):
    with open(p, encoding='utf-8-sig', newline='') as f:
        return list(csv.reader(f))


with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    syn = td / 'syn'
    synth_usage.main(['--out', str(syn), '--n', '10', '--seed', '11', '--raw'])
    tidy = syn / 'tidy.SYNTHETIC.csv'
    truth = json.loads((syn / 'truth.SYNTHETIC.json').read_text(encoding='utf-8'))
    fu = td / 'followup.json'
    fu.write_text(json.dumps({'hr': {'text': 'x', 'short': 'y'}, 'verification': {'text': 'v'}}, ensure_ascii=False, indent=2), encoding='utf-8')
    before = fu.read_text(encoding='utf-8')

    # ── 1) 거절과 미리보기 ──
    r = cli('--in', tidy, '--followup', fu, '--private-dir', td / 'priv')
    ok(r.returncode == 2 and '합성 자료' in r.stderr, '합성 자료 + --draft 없음 → 종료 코드 2')
    ok(fu.read_text(encoding='utf-8') == before and not (td / 'priv').exists(), '거절 때 followup.json·private 그대로')
    r = cli('--in', tidy, '--followup', fu, '--private-dir', td / 'priv', '--draft', '--results', td / 'a.json')
    ok(r.returncode == 0, '--draft 실행 성공: ' + r.stderr)
    F = json.loads(fu.read_text(encoding='utf-8'))
    ok(list(F) == ['hr', 'verification', 'usage'] and F['hr'] == {'text': 'x', 'short': 'y'} and F['verification'] == {'text': 'v'},
       'followup.json 은 usage 키만 더함')
    U = F['usage']
    ok(U['text'].startswith(au.DRAFT_MARK['synthetic']) and U['status'] == 'draft' and U['data_source'] == 'synthetic', '미리보기 표시와 상태')
    ok(isinstance(U['rows'], list) and all(len(x) == 4 and all(isinstance(c, str) for c in x) for x in U['rows']), 'rows = 4칸 문자열 행')
    ok(all('n=' in x[3] for x in U['rows'] if 'p' in x[3]), '차이 칸에 n 표시')
    ok('\n' not in U['text'] and U['text'].count('부산대 재학생') == 1, 'text 는 한 단락')
    ok((td / 'priv' / 'synthetic' / 'usage_participants.csv').exists(), '합성 자료의 참가자 표는 private/synthetic/')
    A = json.loads((td / 'a.json').read_text(encoding='utf-8'))
    got = {p['pid']: p for p in A['participants']}
    ok(sorted(got) == list(range(1, 11)), '유효 참가자 1~10(재응답·시험·동의 안 함 제외)')
    for t in truth['participants']:
        g = got[t['pid']]
        for k in ('group', 'card_score', 'posting_score', 'card_time_s', 'posting_time_s', 'card_ease', 'posting_ease'):
            ok(g[k] == t[k], f"pid {t['pid']} {k}")
    flow = A['analysis']['flow']
    ok(flow['no_consent'] == 1 and flow['test'] == 1 and flow['duplicate_pid'] == 1 and flow['valid'] == 10, '응답 흐름 수')

    # ── 원 응답 시트·get_values JSON 도 같은 결과 ──
    r = cli('--in', syn / 'raw.SYNTHETIC.csv', '--dry-run', '--results', td / 'b.json')
    ok(r.returncode == 0, '원 응답 시트 읽기: ' + r.stderr)
    B = json.loads((td / 'b.json').read_text(encoding='utf-8'))
    strip = lambda pp: [{k: v for k, v in p.items() if k != 'resp_key'} for p in pp]  # noqa: E731
    ok(strip(B['participants']) == strip(A['participants']), '원 응답 시트 = tidy(참가자별)')
    rows = read_csv(tidy)
    (td / 'values.json').write_text(json.dumps({'range': 'tidy!A1:AB14', 'values': rows, 'synthetic': True}, ensure_ascii=False), encoding='utf-8')
    r = cli('--in', td / 'values.json', '--dry-run', '--results', td / 'c.json')
    C = json.loads((td / 'c.json').read_text(encoding='utf-8'))
    ok(r.returncode == 0 and strip(C['participants']) == strip(A['participants']), 'get_values JSON = tidy')
    ok(C['block']['data_source'] == 'synthetic', 'JSON 의 "synthetic": true 도 합성으로 봄')
    vr = {'valueRanges': [{'range': "'tidy_text'!A1:C2", 'values': [['resp_key', 'dh_more', 'tk_more']]}, {'range': "'tidy'!A1:AB14", 'values': rows}]}
    (td / 'batch.SYNTHETIC.json').write_text(json.dumps(vr, ensure_ascii=False), encoding='utf-8')
    r = cli('--in', td / 'batch.SYNTHETIC.json', '--dry-run')
    ok(r.returncode == 0, 'batchGet valueRanges 에서 tidy 범위를 고름')

    # ── 2) 본 결과 보호·live 쓰기·유효 0명·점수 불일치 ──
    live = td / 'tidy_live.csv'
    with live.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        h = rows[0][:-1]                       # synthetic 열 뺌
        w.writerow(h)
        w.writerows(x[:-1] for x in rows[1:])
    fu2 = td / 'fu2.json'
    r = cli('--in', live, '--followup', fu2, '--private-dir', td / 'priv2')
    U2 = json.loads(fu2.read_text(encoding='utf-8'))['usage']
    ok(r.returncode == 0 and U2['status'] == 'final' and U2['data_source'] == 'live' and not U2['text'].startswith('［'), 'live 자료 → final 블록(없던 followup.json 새로 만듦)')
    r = cli('--in', live, '--followup', fu2, '--private-dir', td / 'priv2', '--draft')
    ok(r.returncode == 2 and json.loads(fu2.read_text(encoding='utf-8'))['usage']['status'] == 'final', '본 결과(final) 위에 미리보기 거절')
    r = cli('--in', live, '--followup', fu2, '--private-dir', td / 'priv2')
    ok(r.returncode == 0, 'live 는 final 을 다시 써도 됨')
    only_bad = td / 'bad.csv'
    with only_bad.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(h)
        w.writerows(x[:-1] for x in rows[1:] if x[h.index('status')] != 'complete')
    r = cli('--in', only_bad, '--followup', td / 'fu3.json')
    ok(r.returncode == 2 and not (td / 'fu3.json').exists(), '유효 0명 → 거절')
    wrong = copy.deepcopy(rows)
    wrong[1][h.index('dh_score')] = str((int(wrong[1][h.index('dh_score')]) + 1) % 7)
    (td / 'wrong.SYNTHETIC.csv').write_text('\n'.join(','.join(x) for x in wrong) + '\n', encoding='utf-8')
    r = cli('--in', td / 'wrong.SYNTHETIC.csv', '--dry-run')
    ok(r.returncode == 1 and '정답 키' in r.stderr, '시트 점수 ≠ 정답 키 → 오류(1)')
    flip = copy.deepcopy(rows)
    gi, pi = h.index('group'), h.index('pid')
    k = next(i for i, x in enumerate(flip) if x[pi] == '1')
    flip[k][pi] = '20'
    (td / 'flip.SYNTHETIC.csv').write_text('\n'.join(','.join(x) for x in flip) + '\n', encoding='utf-8')
    r = cli('--in', td / 'flip.SYNTHETIC.csv', '--dry-run')
    ok(r.returncode == 0 and '홀짝' in r.stdout, '참가 번호 홀짝 ≠ 그룹이면 경고만')

# ── 3) 통계·문장 도우미 ──
s = au.paired([6, 5, 6, 4, 6], [4, 5, 3, 4, 2])
ok(s['n'] == 5 and (s['n_pos'], s['n_neg'], s['n_tie']) == (3, 0, 2), '부호 개수')
ok(abs(s['p_sign'] - 0.25) < 1e-12 and abs(s['p_wilcoxon'] - 0.25) < 1e-12, '모두 양수 3명: 부호·윌콕슨 p = 2/8')
d = [1, 2, 0, 1, 3, -1, 1, 0, 2, 1]
s = au.paired(d, [0] * 10)
ok(abs(s['p_sign'] - 0.0703125) < 1e-12, '부호 검정 7:1 → p = 0.0703')
ok(abs(s['p_wilcoxon'] - 0.046875) < 1e-12, '윌콕슨(같은 값 중간 순위) 정확 분포 p = 0.046875(손으로 2^8 열거한 값)')
s = au.paired([3, 3], [3, 3])
ok(s['p_sign'] == 1.0 and s['p_wilcoxon'] == 1.0, '차이가 모두 0이면 p = 1')
ok(au.josa('열교환기(PCHE) 설계', '와/과') == '열교환기(PCHE) 설계와' and au.josa('생산기술1팀', '와/과') == '생산기술1팀과', '와/과')
ok(au.josa('동화엔텍 → 태광후지킨', '으로/로') == '동화엔텍 → 태광후지킨으로' and au.josa('서울', '으로/로') == '서울로', '으로/로')
ok(au.kdates(['2026-11-12', '2026-11-14']) == '2026. 11. 12.~14.' and au.kdates(['2026-11-12']) == '2026. 11. 12.', '날짜 범위')
ok(au.kdates(['2026-11-30', '2026-12-01']) == '2026. 11. 30.~12. 1.', '달이 바뀌는 날짜')
ok(au.parse_ts('2026. 11. 12 오후 2:31:05') == '2026-11-12 14:31' and au.parse_ts('2026. 11. 12. 오전 12:05:00') == '2026-11-12 00:05', '한국어 타임스탬프')
ok(au.parse_ts('2026. 11. 12 오후 12:30:00') == '2026-11-12 12:30' and au.parse_ts('11/12/2026 9:05:00') == '2026-11-12 09:05', '정오·미국식')
ok(au.signed(-70.4, 0) == '−70' and au.signed(1.46, 1) == '+1.5' and au.signed(0.0, 1) == '0.0', '부호 붙인 숫자')

print(f'통과 {len(PASSED)}개')

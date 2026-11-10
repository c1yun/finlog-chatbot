#!/usr/bin/env python3
"""제출본(--desk) 그림 두 장을 만든다. build_report.js가 figs/_desk_fig_data.json을 쓴 뒤 부른다.

- figs/desk_range.png   10곳의 환산점수와 범위(미확인 0점~만점)
- figs/desk_commute.png 부산대에서 근무지까지 자동차 소요 시간·거리와 통근버스·기숙사 공개 여부
흑백으로 인쇄해도 읽히도록 TOP 3는 색과 함께 굵은 글씨·★로, 값은 숫자로 직접 적는다.
"""
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.lines import Line2D

HERE = Path(__file__).resolve().parent
FIGS = HERE / 'figs'
for f in Path.home().glob('.fonts/Pretendard-*.ttf'):
    fm.fontManager.addfont(str(f))
plt.rcParams['font.family'] = 'Pretendard'
plt.rcParams['axes.unicode_minus'] = False

INK, SUB, MUTED = '#1A1A1A', '#52514E', '#8A8F98'
NAVY, STEEL, RANGE, GRID = '#1F3864', '#7F96B5', '#A9B4C2', '#E6E8EB'


def fig_range(rows):
    n = len(rows)
    fig, ax = plt.subplots(figsize=(7.4, 0.33 * n + 0.75), dpi=240)
    for i, r in enumerate(rows):
        y = n - 1 - i
        top = r['top']
        if r['high'] - r['low'] > 0.05:
            ax.hlines(y, r['low'], r['high'], color=RANGE, lw=2.4, zorder=2)
            ax.vlines([r['low'], r['high']], y - 0.16, y + 0.16, color=RANGE, lw=1.6, zorder=2)
        ax.scatter([r['scaled']], [y], s=74, color=NAVY if top else STEEL, edgecolor='white', linewidth=1.3, zorder=3)
        rng = f"({r['low']:.1f}~{r['high']:.1f})" if r['high'] - r['low'] > 0.05 else '(18개 항목 모두 확인)'
        x0 = max(r['high'], r['scaled']) + 1.0
        ax.text(x0, y, f"{r['scaled']:.1f}", va='center', ha='left', fontsize=9.5, fontweight='bold' if top else 'medium', color=INK)
        ax.text(x0 + 3.6, y, rng, va='center', ha='left', fontsize=8, color=SUB)
    ax.set_yticks(range(n))
    labels = []
    for i, r in enumerate(rows):
        tag = ' (주의)' if r['rep'] != '적합' else ''
        labels.append(f"{'★ ' if r['top'] else ''}{r['rank']}  {r['name']}{tag}")
    ax.set_yticklabels(labels[::-1], fontsize=9.5, color=INK)
    for lab, r in zip(ax.get_yticklabels(), rows[::-1]):
        lab.set_fontweight('bold' if r['top'] else 'regular')
    lo = min(r['low'] for r in rows)
    ax.set_xlim(int(lo // 5) * 5 - 2, 96)
    ticks = [t for t in range(50, 81, 10)]
    ax.set_xticks(ticks)
    ax.set_xticklabels([str(t) for t in ticks], fontsize=8.5, color=SUB)
    ax.set_ylim(-0.6, n - 0.4)
    ax.grid(axis='x', color=GRID, lw=0.8, zorder=0)
    ax.set_axisbelow(True)
    for s in ['top', 'right', 'left']:
        ax.spines[s].set_visible(False)
    ax.spines['bottom'].set_color(GRID)
    ax.tick_params(axis='both', length=0)
    ax.set_xlabel('기업 평가 점수(100점 만점)', fontsize=8.5, color=SUB, labelpad=4)
    handles = [
        Line2D([], [], marker='o', color='none', markerfacecolor=NAVY, markeredgecolor='white', markersize=8, label='환산점수(★ 짙은 점은 TOP 3)'),
        Line2D([], [], marker='|', color=RANGE, lw=2.4, markersize=7, markeredgewidth=1.6, label='확인하지 못한 항목을 0점~만점으로 둘 때의 범위'),
    ]
    leg = fig.legend(handles=handles, loc='upper right', bbox_to_anchor=(0.998, 1.0), ncol=2, frameon=False, fontsize=7.8, handletextpad=0.5, columnspacing=1.6)
    for t in leg.get_texts():
        t.set_color(SUB)
    fig.text(0.215, 0.975, '(주의) = 평판 점검 주의', ha='left', va='top', fontsize=7.8, color=SUB)
    fig.subplots_adjust(left=0.215, right=0.995, top=0.925, bottom=0.115)
    fig.savefig(FIGS / 'desk_range.png', facecolor='white')
    plt.close(fig)


def mark(ax, x, y, m):
    if m == '●':
        ax.plot([x], [y], marker='o', color=INK, markersize=6.5, linestyle='none', zorder=3)
    elif m == '◐':
        ax.plot([x], [y], marker='o', markerfacecolor=INK, markerfacecoloralt='white', fillstyle='left', markeredgecolor=INK, markersize=6.5, linestyle='none', zorder=3)
    else:
        ax.plot([x], [y], marker='_', markeredgecolor=INK, markersize=7, markeredgewidth=1.4, linestyle='none', zorder=3)


def fig_commute(rows):
    rows = sorted(rows, key=lambda r: (r['min1'], r['min2']))
    n = len(rows)
    fig, ax = plt.subplots(figsize=(7.4, 0.33 * n + 0.8), dpi=240)
    X_BUS, X_DORM = 107, 118
    for i, r in enumerate(rows):
        y = n - 1 - i
        ax.hlines(y, 0, r['min1'], color=GRID, lw=1.2, zorder=1)
        ax.barh(y, r['min2'] - r['min1'], left=r['min1'], height=0.42, color=STEEL, zorder=2)
        ax.text(r['min2'] + 1.4, y, f"약 {r['min1']}~{r['min2']}분 · {r['km1']}~{r['km2']}km", va='center', ha='left', fontsize=8.6, color=INK)
        mark(ax, X_BUS, y, r['bus'])
        mark(ax, X_DORM, y, r['dorm'])
    ax.text(X_BUS, n - 0.25, '통근버스', va='bottom', ha='center', fontsize=8.5, color=SUB, fontweight='bold')
    ax.text(X_DORM, n - 0.25, '기숙사', va='bottom', ha='center', fontsize=8.5, color=SUB, fontweight='bold')
    ax.set_yticks(range(n))
    ax.set_yticklabels([f"{r['name']} · {r['place']}" for r in rows][::-1], fontsize=9.3, color=INK)
    ax.set_xlim(0, 124)
    ticks = [0, 20, 40, 60]
    ax.set_xticks(ticks)
    ax.set_xticklabels([f'{t}분' for t in ticks], fontsize=8.5, color=SUB)
    ax.set_ylim(-0.6, n + 0.25)
    ax.grid(axis='x', color=GRID, lw=0.8, zorder=0)
    ax.set_axisbelow(True)
    for s in ['top', 'right', 'left']:
        ax.spines[s].set_visible(False)
    ax.spines['bottom'].set_color(GRID)
    ax.tick_params(axis='both', length=0)
    handles = [
        Line2D([], [], color=STEEL, lw=6, label='두 경로 계산기의 범위'),
        Line2D([], [], marker='o', color='none', markerfacecolor=INK, markeredgecolor=INK, markersize=6.5, label='회사가 공고·공식 자료에 밝힘'),
        Line2D([], [], marker='o', color='none', markerfacecolor=INK, markerfacecoloralt='white', fillstyle='left', markeredgecolor=INK, markersize=6.5, label='일부만 확인'),
        Line2D([], [], marker='_', color='none', markeredgecolor=INK, markersize=7, markeredgewidth=1.4, label='공개자료에서 찾지 못함'),
    ]
    leg = fig.legend(handles=handles, loc='lower right', bbox_to_anchor=(0.998, 0.0), ncol=4, frameon=False, fontsize=7.8, handletextpad=0.6, handlelength=1.4, columnspacing=1.4)
    for t in leg.get_texts():
        t.set_color(SUB)
    fig.subplots_adjust(left=0.215, right=0.995, top=0.94, bottom=0.14)
    fig.savefig(FIGS / 'desk_commute.png', facecolor='white')
    plt.close(fig)


def main():
    data = json.loads((FIGS / '_desk_fig_data.json').read_text(encoding='utf-8'))
    fig_range(data['range'])
    fig_commute(data['commute'])
    print('figs: desk_range.png, desk_commute.png')


if __name__ == '__main__':
    main()

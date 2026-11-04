# Mobile and Desktop Standards

Mobile browser is the primary product target. Design, implement and accept mobile first. Desktop is a separate, deliberately composed professional experience. Do not simply shrink desktop for mobile or enlarge mobile for desktop.

Shared tokens, typography, data contracts and low-level UI primitives may be reused. Page composition, information hierarchy, navigation, density, trade workspace, forms, tables, sticky controls and interaction patterns must be intentionally specified and tested separately.

## Mobile browser

Required widths: 320, 360, 375, 390 and 430 CSS px. Test iOS Safari where available and record Android browser coverage where available. Record browser/version, device or emulator, viewport, route, evidence and result. If unavailable, mark NOT RUN; source inspection is not a browser test.

Build a phone-first composition. Do not squeeze desktop columns onto a phone. Prevent page-level horizontal overflow, clipping, overlap and unreachable actions. Respect iOS safe areas. Fixed navigation must reserve content space. Touch targets should be at least 44 by 44 CSS px where practical. Do not rely on hover. Forms must work with the on-screen keyboard open. Financial values must remain legible and unambiguous. Use local table scrolling only when needed, never page-wide sideways scrolling. Standard and important status dialogs remain centered; drawers are for secondary selection, filters and chart interactions.

Mobile trade is not a shrunken desktop terminal. Order entry and order book must be composed for phone use. The approved direction is order entry on the left and market depth on the right where the width supports it. At narrow widths use a documented compact composition without page overflow. Chart is collapsed by default in a bottom pull-up drawer and must not cover navigation or essential controls. Lower order/position/history/trade information uses a mobile-appropriate tab or section pattern.

## Desktop browser

Required widths: 1024, 1280, 1440 and 1920 CSS px where available. Test and record independently from mobile. Do not enlarge mobile cards or vertical stacks as the desktop design. Use the available width for a professional exchange workstation, appropriate horizontal work areas, aligned market data and readable information density. Desktop navigation may differ from mobile bottom navigation. Hover may enhance but must not be required for core actions. Dialogs remain centered.

Desktop trade uses a horizontal workstation, not a tall mobile stack. Pair/price, order book/market depth and buy/sell entry occupy clear adjacent areas according to verified features. Current orders, positions, history and trades belong below. Chart/K-line is a collapsible bottom drawer/panel.

## Tablet and independent acceptance

Tablet is an intermediate target and must be recorded separately. For every route record Mobile PASS/FAIL/NOT RUN, Desktop PASS/FAIL/NOT RUN and Tablet PASS/FAIL/NOT RUN. One target's PASS never substitutes for another. Media queries may switch between distinct compositions; they do not excuse forcing one unsuitable layout onto all devices.

Acceptance must check route/link correctness, console and critical network failures, page overflow, clipping, reachable actions, accurate loading/empty/error/success/disabled/restricted states, usable dialogs, touch/keyboard operation, financial value legibility and unchanged business/API behavior. Record route, target, exact browser and viewport, evidence, test steps, result, defects, tester/date and commit SHA. A source review is not a browser test.
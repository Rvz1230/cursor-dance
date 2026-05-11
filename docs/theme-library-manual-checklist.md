# Theme Library Manual Checklist

Updated: 2026-05-11

Use this checklist to validate the new theme library flows in the local workbench at `http://localhost:5173/`.

## Test Data

- Import sample:
  - [theme-import-sample.json](/Users/rvz/Projects/cursor-dance/docs/theme-import-sample.json)

## Flow A: Create Theme

1. Open the theme library sidebar and click `新建`.
2. In the modal, keep `起始模板` as `空白主题`, enter:
   - Theme name: `Studio Verify A`
   - Description: `Manual validation theme`
3. Click `创建主题`.

Expected:

- Modal closes.
- A new theme card named `Studio Verify A` appears in the left list.
- The new theme is automatically selected.
- The workbench remains editable and does not crash.

## Flow B: Create From Existing Theme

1. Click `新建` again.
2. Set `起始模板` to any existing theme, for example `木鱼方案`.
3. Name it `Woodfish Clone Check`.
4. Click `创建主题`.

Expected:

- New theme appears in the list and is selected.
- Core action settings are copied from the base theme instead of resetting to empty defaults.
- Changing a setting on the clone does not mutate the original theme card when you switch back.

## Flow C: Import Theme JSON

1. Click `导入`.
2. Choose [theme-import-sample.json](/Users/rvz/Projects/cursor-dance/docs/theme-import-sample.json).

Expected:

- Imported theme appears in the list as `Mint Lab Demo`.
- The imported theme is automatically selected.
- `leftClick`, `doubleClick`, `wheel`, and `hover` configurations show non-default values from the file.
- Preview rail updates without throwing UI errors.

## Flow D: Save And Refresh

1. After creating or importing a theme, click the top `保存`.
2. Refresh the page.

Expected:

- Newly created/imported themes still exist after refresh.
- The selected theme remains available in the list.
- Switching between built-in and custom/imported themes still works.

## Flow E: Trigger Configuration Persistence

On the imported theme:

1. Switch to `doubleClick`.
2. Confirm `触发时机` is `第二次抬起后`.
3. Confirm `波纹样式` is `柔和面波`.
4. Confirm `粒子形态` is `火花`.
5. Click `保存`, then refresh.

Expected:

- The same values remain selected after refresh.
- Preview still renders without layout or console-breaking errors.

## Flow F: Invalid Import Guard

1. Create a temporary file with invalid JSON, for example:

```json
{ "themePack": }
```

2. Import it through the modal.

Expected:

- Modal stays open.
- A readable error message appears in the import panel.
- Existing themes are not removed or replaced.

## Optional Runtime Check

If the extension options page is loaded inside Chrome as a real extension options view:

1. Select `Mint Lab Demo`.
2. Click `保存`.
3. Trigger `leftClick`, `doubleClick`, `wheel`, and `hover` on a normal `http/https` page.

Expected:

- `leftClick` shows text + ripple + particles.
- `doubleClick` uses stronger combo feedback.
- `wheel` only reacts on downward scroll for the sample theme.
- `hover` only reacts on buttons/links after a short delay.

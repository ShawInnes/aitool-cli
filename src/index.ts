import {
  Box,
  BoxRenderable,
  createCliRenderer,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  Text,
  TextAttributes,
  TextRenderable,
} from '@opentui/core';
import {ModelPricesSchema} from './schema.ts';

const source_url = 'https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json';

const renderer = await createCliRenderer({exitOnCtrlC: true, enableMouseMovement: true});

// Fetch and validate model data
const response = await fetch(source_url);
const raw = await response.json() as Record<string, unknown>;
delete raw['sample_spec'];
const data = ModelPricesSchema.parse(raw);

// Column widths (chars)
const COL_MODEL = 45;
const COL_PROVIDER = 12;
const COL_MODE = 12;
const COL_MAX_IN = 9;
const COL_MAX_OUT = 9;
const COL_COST = 11;

function pad(str: string, len: number): string {
  if (str.length > len) return str.slice(0, len - 1) + '…';
  return str.padEnd(len);
}

function fmtCost(cost: number | undefined | null): string {
  if (cost == null) return pad('-', COL_COST);
  return pad(`$${(cost * 1_000_000).toFixed(2)}/1M`, COL_COST);
}

function fmtNum(n: number | undefined | null, width: number): string {
  if (n == null) return pad('-', width);
  if (n >= 1_000_000) return pad(`${(n / 1_000_000).toFixed(1)}M`, width);
  if (n >= 1_000) return pad(`${Math.round(n / 1_000)}k`, width);
  return pad(String(n), width);
}

const HEADER_BG = '#2a2a3e';
const ALT_ROW_BG = '#1e1e2e';
const DIM = '#7e7885';
const TEAL = '#88ccc0';
const YELLOW = '#f8f47f';
const PURPLE = '#b0a0c0';
const GREEN = '#7e9885';

const APPROVED = '#2dd327';
const BANNED = '#f34a4a';


// Column header row (construct VNode — static, no interaction needed)
const columnHeader = Box(
  {flexDirection: 'row', backgroundColor: HEADER_BG, paddingLeft: 1},
  Text({content: '  ', fg: TEAL}),
  Text({content: pad('Model', COL_MODEL), fg: TEAL, attributes: TextAttributes.BOLD}),
  Text({content: pad('Provider', COL_PROVIDER), fg: TEAL, attributes: TextAttributes.BOLD}),
  Text({content: pad('Mode', COL_MODE), fg: TEAL, attributes: TextAttributes.BOLD}),
  Text({content: pad('Max In', COL_MAX_IN), fg: TEAL, attributes: TextAttributes.BOLD}),
  Text({content: pad('Max Out', COL_MAX_OUT), fg: TEAL, attributes: TextAttributes.BOLD}),
  Text({content: pad('In $/1M', COL_COST), fg: TEAL, attributes: TextAttributes.BOLD}),
  Text({content: pad('Out $/1M', COL_COST), fg: TEAL, attributes: TextAttributes.BOLD}),
);

const IsApprovedModel = (model_name: string, provider: string): boolean => {
  return ((model_name.includes('claude-opus-4-6') ||
        model_name.includes('claude-haiku-4-5') ||
        model_name.includes('claude-sonnet-4-5'))
      && provider.includes('bedrock')) ||
    ((model_name.includes('claude-opus-4-5') ||
        model_name.includes('claude-haiku-4-5') ||
        model_name.includes('claude-sonnet-4-5') ||
        model_name.includes('bge-large'))
      && provider.includes('databricks'));
};

const IsBannedModel = (model_name: string, provider: string): boolean => {
  return model_name.includes('deepseek');
};

// Pre-build all row renderables imperatively so we can add/remove them on filter
const allRows = Object.entries(data).map(([modelName, info], i) => {
  const row = new BoxRenderable(renderer, {
    id: `row-${i}`,
    flexDirection: 'row',
    backgroundColor: i % 2 === 0 ? undefined : ALT_ROW_BG,
    paddingLeft: 1,
  });

  const isApprovedModel = IsApprovedModel(modelName, info.litellm_provider ?? '');
  const isBannedModel = IsBannedModel(modelName, info.litellm_provider ?? '');
  row.add(new TextRenderable(renderer, {
    content: isApprovedModel ? '✓ ' : isBannedModel ? '✗ ' : '  ',
    fg: isApprovedModel ? APPROVED : isBannedModel ? BANNED : '#e0e0e0',
  }));
  row.add(new TextRenderable(renderer, {
    content: pad(modelName, COL_MODEL),
    fg: isApprovedModel ? APPROVED : isBannedModel ? BANNED : '#e0e0e0',
  }));
  row.add(new TextRenderable(renderer, {content: pad(info.litellm_provider ?? '-', COL_PROVIDER), fg: YELLOW}));
  row.add(new TextRenderable(renderer, {content: pad(info.mode ?? '-', COL_MODE), fg: PURPLE}));
  row.add(new TextRenderable(renderer, {content: fmtNum(info.max_input_tokens, COL_MAX_IN), fg: GREEN}));
  row.add(new TextRenderable(renderer, {content: fmtNum(info.max_output_tokens, COL_MAX_OUT), fg: GREEN}));
  row.add(new TextRenderable(renderer, {content: fmtCost(info.input_cost_per_token), fg: TEAL}));
  row.add(new TextRenderable(renderer, {content: fmtCost(info.output_cost_per_token), fg: TEAL}));
  return {
    row,
    isApproved: isApprovedModel,
    isBanned: isBannedModel,
    searchKey: `${modelName} ${info.litellm_provider ?? ''} ${info.mode ?? ''}`.toLowerCase(),
  };
});

// Search bar
const searchBar = new BoxRenderable(renderer, {
  flexDirection: 'row',
  border: ['bottom'],
  borderColor: DIM,
  paddingLeft: 1,
  alignItems: 'center',
  gap: 1,
});
searchBar.add(new TextRenderable(renderer, {content: 'Search:', fg: DIM}));

const searchInput = new InputRenderable(renderer, {
  flexGrow: 1,
  placeholder: 'filter by model, provider, or mode…',
  placeholderColor: DIM,
  backgroundColor: '#1a1a2e',
  textColor: '#e0e0e0',
  cursorColor: TEAL,
  focusedBackgroundColor: '#1a1a2e',
});
searchBar.add(searchInput);
searchInput.focus();

// Scrollable model list
// panel ~3 rows + table border top/bottom (2) + col header (1) + search bar (2) = 8
const scrollbox = new ScrollBoxRenderable(renderer, {
  height: renderer.height - 8,
  focusable: true,
});
for (const {row} of allRows) {
  scrollbox.add(row);
}

let approvedOnly = false;
let bannedOnly = false;

function applyFilter() {
  const lower = searchInput.value.toLowerCase();
  for (const child of scrollbox.getChildren()) {
    scrollbox.remove(child.id);
  }
  for (const {row, searchKey, isApproved, isBanned} of allRows) {
    if (approvedOnly && !isApproved) continue;
    if (bannedOnly && !isBanned) continue;
    if (searchKey.includes(lower)) {
      scrollbox.add(row);
    }
  }
  scrollbox.scrollTo(0);
}

// Filter rows on input change
searchInput.on(InputRenderableEvents.CHANGE, () => applyFilter());

// Help dialog (hidden initially, toggled with ?)
const DIALOG_W = 46;
const DIALOG_H = 10;
const dialogLeft = Math.floor((renderer.width - DIALOG_W) / 2);
const dialogTop = Math.floor((renderer.height - DIALOG_H) / 2);

const shortcuts: [string, string][] = [
  ['?', 'Toggle this help'],
  ['/', 'Focus search'],
  ['a', 'Toggle approved-only filter'],
  ['b', 'Toggle banned-only filter'],
  ['Esc', 'Focus grid / close help'],
  ['↑ ↓', 'Scroll list'],
  ['Ctrl+C', 'Quit'],
];

const helpDialog = new BoxRenderable(renderer, {
  id: 'help-dialog',
  position: 'absolute',
  left: dialogLeft,
  top: dialogTop,
  width: DIALOG_W,
  borderStyle: 'rounded',
  borderColor: TEAL,
  backgroundColor: '#16161e',
  flexDirection: 'column',
  paddingX: 2,
  paddingY: 1,
  title: ' Keyboard Shortcuts ',
  titleAlignment: 'center',
});

for (const [keys, desc] of shortcuts) {
  const shortcutRow = new BoxRenderable(renderer, {flexDirection: 'row', gap: 1});
  shortcutRow.add(new TextRenderable(renderer, {content: keys.padEnd(10), fg: TEAL, attributes: TextAttributes.BOLD}));
  shortcutRow.add(new TextRenderable(renderer, {content: desc, fg: '#e0e0e0'}));
  helpDialog.add(shortcutRow);
}

let helpVisible = false;

// Keyboard shortcuts: / to focus search, Escape to focus grid, ? to toggle help
renderer.keyInput.on('keypress', (key) => {
  if (key.name === '?') {
    key.preventDefault();
    helpVisible = !helpVisible;
    if (helpVisible) {
      renderer.root.add(helpDialog);
    } else {
      renderer.root.remove('help-dialog');
    }
  } else if (helpVisible && key.name === 'escape') {
    helpVisible = false;
    renderer.root.remove('help-dialog');
  } else if (key.name === 'a' && !searchInput.focused) {
    approvedOnly = !approvedOnly;
    if (approvedOnly) bannedOnly = false;
    applyFilter();
  } else if (key.name === 'b' && !searchInput.focused) {
    bannedOnly = !bannedOnly;
    if (bannedOnly) approvedOnly = false;
    applyFilter();
  } else if (key.name === '/' && !searchInput.focused) {
    key.preventDefault();
    searchInput.focus();
  } else if (key.name === 'escape' && searchInput.focused) {
    searchInput.clear();
    searchInput.blur();
  }
});

// Table container
const tableBox = new BoxRenderable(renderer, {
  borderStyle: 'rounded',
  borderColor: DIM,
  flexDirection: 'column',
  title: ' LLM Models ',
  titleAlignment: 'center',
});
tableBox.add(columnHeader);
tableBox.add(searchBar);
tableBox.add(scrollbox);

renderer.root.add(tableBox);

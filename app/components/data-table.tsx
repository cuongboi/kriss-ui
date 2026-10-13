import {
  type AccessorFn,
  type AccessorFnColumnDef,
  type AccessorKeyColumnDef,
  type CellData,
  type Column,
  type ColumnDef,
  type ColumnHelper,
  type ColumnSizingState,
  type ColumnVisibilityState,
  type Table as CoreTable,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  type DeepKeys,
  type DeepValue,
  type DisplayColumnDef,
  type Header,
  type IdentifiedColumnDef,
  type OnChangeFn,
  type PaginationState,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
  InboxIcon,
  SearchIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { flushSync } from "react-dom";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ── Features & types ────────────────────────────────────────────────────────

/** Extra column options read by the table, typed on every `meta` of these columns. */
export type DataTableColumnMeta = {
  /** Header text and name in the "View" menu (defaults to the column id). */
  label?: string;
  /** Classes applied to both the header and the cells, e.g. "text-right". */
  className?: string;
};

/**
 * One feature set for every table in the app. Client tables use the sorted/paginated row
 * models; server tables set `manualSorting`/`manualPagination`, which bypasses them.
 */
const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  // Type-only slot: scopes `meta` to these tables instead of augmenting TanStack globally.
  columnMeta: {} as DataTableColumnMeta,
});

export type DataTableFeatures = typeof dataTableFeatures;
/** A column of any value type; `defineColumns` keeps each column's own value type while authoring. */
export type DataTableColumn<T extends RowData> = ColumnDef<
  DataTableFeatures,
  T,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous TValue, same as TanStack's `columns()`
  any
>;
export type DataTableInstance<T extends RowData> = ReactTable<
  DataTableFeatures,
  T
>;

// ── Messages ────────────────────────────────────────────────────────────────

export type DataTableMessages = {
  search: string;
  clearSearch: string;
  view: string;
  toggleColumns: string;
  rowsPerPage: string;
  page: (page: number, count: number) => string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  sortBy: (title: string) => string;
  resizeColumn: (title: string) => string;
  actions: string;
  selectAll: string;
  selectRow: string;
  emptyTitle: string;
  emptyDescription: string;
};

const DEFAULT_MESSAGES: DataTableMessages = {
  search: "Search…",
  clearSearch: "Clear search",
  view: "View",
  toggleColumns: "Toggle columns",
  rowsPerPage: "Rows per page",
  page: (page, count) => `Page ${page} of ${count}`,
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page",
  sortBy: (title) => `Sort by ${title}`,
  resizeColumn: (title) => `Resize ${title} column`,
  actions: "Actions",
  selectAll: "Select all",
  selectRow: "Select row",
  emptyTitle: "No results",
  emptyDescription: "There is nothing to show here yet.",
};

const MessagesContext = React.createContext(DEFAULT_MESSAGES);
const useMessages = () => React.useContext(MessagesContext);

const numberFormat = new Intl.NumberFormat();

// ── Columns ─────────────────────────────────────────────────────────────────

export type DataTableColumnHelper<T extends RowData> = Omit<
  ColumnHelper<DataTableFeatures, T>,
  "accessor"
> & {
  /**
   * Same as TanStack's `accessor`, but as plain overloads: its conditional parameter type skips
   * excess-property checks, so a typo like `meta: { lable }` would otherwise compile.
   */
  accessor: {
    <K extends DeepKeys<T>>(
      key: K,
      column: IdentifiedColumnDef<DataTableFeatures, T, DeepValue<T, K>>,
    ): AccessorKeyColumnDef<DataTableFeatures, T, DeepValue<T, K>>;
    <V>(
      fn: AccessorFn<T, V>,
      column: DisplayColumnDef<DataTableFeatures, T, V>,
    ): AccessorFnColumnDef<DataTableFeatures, T, V>;
  };
  /** Leading checkbox column; pair with the `rowSelection` / `onRowSelectionChange` props. */
  select: () => DataTableColumn<T>;
  /**
   * Trailing column with per-row actions. `Actions` is rendered as a component, so it may use
   * hooks; declare it at module scope to keep its identity stable.
   */
  actions: (Actions: React.ComponentType<{ row: T }>) => DataTableColumn<T>;
};

function selectionColumn<T extends RowData>(): DataTableColumn<T> {
  return createColumnHelper<DataTableFeatures, T>().display({
    id: "select",
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => (
      <RowCheckbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={() => row.toggleSelected(!row.getIsSelected())}
      />
    ),
    enableHiding: false,
    enableResizing: false,
    enableSorting: false,
    size: 36,
    minSize: 36,
    meta: { className: "w-9" },
  });
}

function actionsColumn<T extends RowData>(
  Actions: React.ComponentType<{ row: T }>,
): DataTableColumn<T> {
  return createColumnHelper<DataTableFeatures, T>().display({
    id: "actions",
    header: () => <ActionsHeader />,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-0.5">
        <Actions row={row.original} />
      </div>
    ),
    enableHiding: false,
    enableResizing: false,
    size: 40,
    minSize: 0,
    meta: { className: "w-0 text-right" },
  });
}

// The helper is stateless, so one instance serves every row type.
const sharedColumnHelper = {
  ...createColumnHelper<DataTableFeatures, RowData>(),
  select: selectionColumn,
  actions: actionsColumn,
};

/**
 * Builds a table's columns with `T` given once. Accessors infer their value type, and
 * `col.select()` / `col.actions(Component)` add the built-in columns:
 *
 * ```tsx
 * const columns = defineColumns<User>((col) => [
 *   col.select(),
 *   col.accessor("email", { header: DataTableColumnHeader, meta: { label: "Email" } }),
 *   col.actions(UserActions),
 * ])
 * ```
 */
export function defineColumns<T extends RowData>(
  build: (col: DataTableColumnHelper<T>) => readonly DataTableColumn<T>[],
): DataTableColumn<T>[] {
  return [...build(sharedColumnHelper as unknown as DataTableColumnHelper<T>)];
}

/**
 * Header that cycles sorting: none → asc → desc → none.
 * The cycle is explicit so TanStack's `sortDescFirst` auto-detection (numbers/dates start at desc)
 * doesn't change the order per column. Shift-click keeps other sorted columns (multi-sort).
 * Pass it directly as `header: DataTableColumnHeader`; the title defaults to `meta.label`.
 */
export function DataTableColumnHeader<
  T extends RowData,
  TValue extends CellData,
>({
  column,
  title = column.columnDef.meta?.label ?? column.id,
  className,
}: {
  column: Column<DataTableFeatures, T, TValue>;
  title?: string;
  className?: string;
}) {
  const messages = useMessages();
  if (!column.getCanSort()) {
    return (
      <span className={cn("block truncate", className)} title={title}>
        {title}
      </span>
    );
  }

  const sorted = column.getIsSorted();

  const Icon =
    sorted === "asc"
      ? ArrowUpIcon
      : sorted === "desc"
        ? ArrowDownIcon
        : ChevronsUpDownIcon;

  const handleClick = (event: React.MouseEvent) => {
    const multi = event.shiftKey && column.getCanMultiSort();
    if (sorted === "desc") column.clearSorting();
    else column.toggleSorting(sorted === "asc", multi);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-8 max-w-[calc(100%+0.5rem)] gap-1 px-2 data-[sorted=true]:text-foreground",
        className,
      )}
      data-sorted={!!sorted}
      onClick={handleClick}
      aria-label={messages.sortBy(title)}
    >
      <span className="truncate">{title}</span>
      <Icon className={cn("size-3.5", !sorted && "text-muted-foreground/60")} />
    </Button>
  );
}

function ActionsHeader() {
  return <span className="sr-only">{useMessages().actions}</span>;
}

function SelectAllCheckbox<T extends RowData>({
  table,
}: {
  table: CoreTable<DataTableFeatures, T>;
}) {
  const messages = useMessages();
  const all = table.getIsAllPageRowsSelected();
  const some = table.getIsSomePageRowsSelected();
  return (
    <Checkbox
      aria-label={messages.selectAll}
      checked={all ? true : some ? "indeterminate" : false}
      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
    />
  );
}

function RowCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label={useMessages().selectRow}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  );
}

// ── Column sizing (persisted) ───────────────────────────────────────────────

type ColumnSizingStore = {
  /** Column widths in px, keyed by table id, then column id. */
  tables: Record<string, ColumnSizingState>;
  setSizing: (tableId: string, updater: Updater<ColumnSizingState>) => void;
  /** Drops a table's widths so it goes back to automatic layout. */
  resetSizing: (tableId: string) => void;
};

const NO_SIZING: ColumnSizingState = {};

export const useColumnSizingStore = create<ColumnSizingStore>()(
  persist(
    (set) => ({
      tables: {},
      setSizing: (tableId, updater) =>
        set(({ tables }) => {
          const current = tables[tableId] ?? NO_SIZING;
          const next =
            typeof updater === "function" ? updater(current) : updater;
          return { tables: { ...tables, [tableId]: next } };
        }),
      resetSizing: (tableId) =>
        set(({ tables }) => {
          const rest = { ...tables };
          delete rest[tableId];
          return { tables: rest };
        }),
    }),
    {
      name: "data-table:column-sizing",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ tables }) => ({ tables }),
    },
  ),
);

/** Widths persisted per `tableId`, or kept in component state for anonymous tables. */
function useColumnSizing(tableId: string | undefined) {
  const persisted = useColumnSizingStore((s) =>
    tableId ? (s.tables[tableId] ?? NO_SIZING) : NO_SIZING,
  );
  const setPersisted = useColumnSizingStore((s) => s.setSizing);
  const resetPersisted = useColumnSizingStore((s) => s.resetSizing);
  const [local, setLocal] = React.useState<ColumnSizingState>(NO_SIZING);

  const setSizing: OnChangeFn<ColumnSizingState> = React.useCallback(
    (updater) => (tableId ? setPersisted(tableId, updater) : setLocal(updater)),
    [tableId, setPersisted],
  );
  const resetSizing = React.useCallback(
    () => (tableId ? resetPersisted(tableId) : setLocal(NO_SIZING)),
    [tableId, resetPersisted],
  );
  return [tableId ? persisted : local, setSizing, resetSizing] as const;
}

const KEYBOARD_STEP = 10;
const KEYBOARD_STEP_LARGE = 50;

/**
 * Drag handle on a header's right edge. Arrow keys resize too (Shift for bigger steps), and a
 * double click resets the whole table to automatic widths.
 */
function ResizeHandle<T extends RowData>({
  header,
  onResizeStart,
  onReset,
}: {
  header: Header<DataTableFeatures, T, unknown>;
  /** Runs before a resize so the table can freeze its current widths. */
  onResizeStart: () => void;
  onReset: () => void;
}) {
  const messages = useMessages();
  const { column } = header;
  const label = messages.resizeColumn(
    column.columnDef.meta?.label ?? column.id,
  );

  const startResize = (event: React.MouseEvent | React.TouchEvent) => {
    onResizeStart();
    header.getResizeHandler()(event);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const direction =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    onResizeStart();
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    header.table.setColumnSizing((old) => ({
      ...old,
      [column.id]: column.getSize() + direction * step,
    }));
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focused or dragged
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(column.getSize())}
      tabIndex={0}
      title={label}
      onMouseDown={startResize}
      onTouchStart={startResize}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none select-none outline-none",
        "after:absolute after:inset-y-2 after:right-0 after:w-px after:bg-border after:opacity-0 after:transition-opacity",
        "group-hover/header:after:opacity-100 hover:after:inset-y-0 hover:after:w-0.5 hover:after:bg-primary/60",
        "focus-visible:after:inset-y-0 focus-visible:after:w-0.5 focus-visible:after:bg-ring focus-visible:after:opacity-100",
        column.getIsResizing() &&
          "after:inset-y-0 after:w-0.5 after:bg-primary after:opacity-100",
      )}
    />
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

export type DataTableToolbarProps = {
  search?: string;
  /** Shows a debounced search box when set. */
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls rendered next to the search box. */
  filters?: React.ReactNode;
  /** Primary actions on the right (e.g. "New …"). */
  actions?: React.ReactNode;
};

const SEARCH_DEBOUNCE_MS = 300;

/** Search, filters, column-visibility menu and actions. Pass its props as the table's `toolbar`. */
export function DataTableToolbar<T extends RowData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
}: DataTableToolbarProps & { table: DataTableInstance<T> }) {
  const messages = useMessages();
  const hideable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange && (
        <DebouncedSearch
          value={search ?? ""}
          onChange={onSearchChange}
          placeholder={searchPlaceholder ?? messages.search}
        />
      )}
      {filters}
      <div className="ml-auto flex items-center gap-2">
        {hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:inline-flex"
              >
                <Settings2Icon />
                {messages.view}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>{messages.toggleColumns}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideable.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(!!checked)
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.columnDef.meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {actions}
      </div>
    </div>
  );
}

function DebouncedSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const messages = useMessages();
  const [draft, setDraft] = React.useState(value);

  // Follow external changes (e.g. back/forward navigation) — adjusted during render, not in an effect.
  const [synced, setSynced] = React.useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }

  React.useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <InputGroup className="w-full sm:w-64">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {draft && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={messages.clearSearch}
            onClick={() => setDraft("")}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 20, 50, 100];

function Pagination<T extends RowData>({
  table,
  rowCount,
}: {
  table: DataTableInstance<T>;
  rowCount: number;
}) {
  const messages = useMessages();
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const from = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(rowCount, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
      <p className="tabular-nums">
        {numberFormat.format(from)}–{numberFormat.format(to)} /{" "}
        {numberFormat.format(rowCount)}
      </p>
      <div className="flex items-center gap-4">
        {PAGE_SIZES.includes(pageSize) && (
          <div className="hidden items-center gap-2 sm:flex">
            <span>{messages.rowsPerPage}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="tabular-nums">
          {messages.page(pageIndex + 1, pageCount)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            aria-label={messages.firstPage}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.firstPage()}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={messages.previousPage}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={messages.nextPage}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            aria-label={messages.lastPage}
            disabled={!table.getCanNextPage()}
            onClick={() => table.lastPage()}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DataTable ───────────────────────────────────────────────────────────────

export type ServerPaging = {
  rowCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
};

type PagingProps =
  | {
      server?: undefined;
      /** Client-side page size; `false` renders every row without pagination. */
      pageSize?: number | false;
    }
  | {
      /** Server-driven paging and sorting. */
      server: ServerPaging;
      pageSize?: never;
    };

type SelectionProps<T extends RowData> =
  | {
      rowSelection?: undefined;
      onRowSelectionChange?: undefined;
      canSelectRow?: undefined;
      getRowId?: (row: T) => string;
    }
  | {
      /** Controlled row selection, keyed by `getRowId`. */
      rowSelection: RowSelectionState;
      onRowSelectionChange: OnChangeFn<RowSelectionState>;
      /** Which rows may be selected (default: all). */
      canSelectRow?: (row: T) => boolean;
      getRowId: (row: T) => string;
    };

export type DataTableProps<T extends RowData> = PagingProps &
  SelectionProps<T> & {
    columns: readonly DataTableColumn<T>[];
    /** `undefined` while the first load is pending (shows skeleton rows when `isLoading`). */
    data: readonly T[] | undefined;
    isLoading?: boolean;
    /**
     * Stable key under which column widths are saved to localStorage. Without it the table is
     * still resizable, but widths reset on reload.
     */
    tableId?: string;
    rowClassName?: (row: T) => string | undefined;
    /** Toolbar props, or a render function for a custom toolbar. */
    toolbar?:
      | DataTableToolbarProps
      | ((table: DataTableInstance<T>) => React.ReactNode);
    /** Columns hidden initially (user can re-enable them from the "View" menu). */
    initialColumnVisibility?: ColumnVisibilityState;
    /** Overrides for any text the table renders (translations, custom empty state). */
    messages?: Partial<DataTableMessages>;
    className?: string;
  };

const NO_ROWS: never[] = [];
const NO_SELECTION: RowSelectionState = {};
const NO_VISIBILITY: ColumnVisibilityState = {};
const SKELETON_ROWS = 6;
const MIN_COLUMN_WIDTH = 60;
const DEFAULT_COLUMN = { minSize: MIN_COLUMN_WIDTH };

export function DataTable<T extends RowData>({
  tableId,
  columns,
  data,
  isLoading,
  server,
  pageSize = 10,
  getRowId,
  rowSelection,
  onRowSelectionChange,
  canSelectRow,
  rowClassName,
  toolbar,
  initialColumnVisibility = NO_VISIBILITY,
  messages: messageOverrides,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize || Number.MAX_SAFE_INTEGER,
  });
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>(initialColumnVisibility);
  const [columnSizing, setColumnSizing, resetColumnSizing] =
    useColumnSizing(tableId);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const messages = React.useMemo(
    () => ({ ...DEFAULT_MESSAGES, ...messageOverrides }),
    [messageOverrides],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns: columns as DataTableColumn<T>[],
    data: data ?? NO_ROWS,
    getRowId,
    state: {
      sorting: server?.sorting ?? sorting,
      pagination: server?.pagination ?? pagination,
      columnVisibility,
      columnSizing,
      rowSelection: rowSelection ?? NO_SELECTION,
    },
    onRowSelectionChange,
    enableRowSelection: canSelectRow
      ? (row) => canSelectRow(row.original)
      : !!onRowSelectionChange,
    onSortingChange: server?.onSortingChange ?? setSorting,
    onPaginationChange: server?.onPaginationChange ?? setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    defaultColumn: DEFAULT_COLUMN,
    manualSorting: !!server,
    manualPagination: !!server,
    rowCount: server?.rowCount,
  });

  const rows = table.getRowModel().rows;
  const leafColumns = table.getVisibleLeafColumns();
  const showPagination = !!server || pageSize !== false;

  // Until the user resizes something the browser lays columns out from their content. The first
  // resize freezes the rendered widths so nothing jumps, then switches to a fixed layout where
  // every column but the last keeps its width; the last one absorbs the remaining space.
  const isSized = Object.keys(columnSizing).length > 0;
  const fillColumn = leafColumns.at(-1);
  const minTableWidth = leafColumns.reduce(
    (sum, column) =>
      sum +
      (column === fillColumn && column.getCanResize()
        ? MIN_COLUMN_WIDTH
        : column.getSize()),
    0,
  );
  const isResizing = !!table.state.columnResizing.isResizingColumn;

  const freezeWidths = () => {
    if (isSized || !tableRef.current) return;
    const sizes: ColumnSizingState = {};
    for (const th of tableRef.current.querySelectorAll<HTMLElement>(
      "thead th[data-column-id]",
    )) {
      sizes[th.dataset.columnId as string] = Math.round(
        th.getBoundingClientRect().width,
      );
    }
    // Commit synchronously so the resize handler starts from the measured widths.
    flushSync(() => setColumnSizing(sizes));
  };

  const fixedCell = isSized && "overflow-hidden text-ellipsis";

  return (
    <MessagesContext.Provider value={messages}>
      <div className={cn("flex flex-col gap-3", className)}>
        {typeof toolbar === "function"
          ? toolbar(table)
          : toolbar && <DataTableToolbar table={table} {...toolbar} />}
        <div
          className={cn(
            "overflow-hidden rounded-lg border bg-card",
            isResizing && "cursor-col-resize select-none",
          )}
        >
          <Table
            ref={tableRef}
            style={
              isSized
                ? { tableLayout: "fixed", minWidth: minTableWidth }
                : undefined
            }
          >
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="group/header hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => {
                    const isFill = header.column === fillColumn;
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        data-column-id={header.column.id}
                        className={cn(
                          "relative",
                          fixedCell,
                          header.column.columnDef.meta?.className,
                        )}
                        style={
                          isSized
                            ? { width: isFill ? "auto" : header.getSize() }
                            : undefined
                        }
                      >
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                        {!isFill && header.column.getCanResize() && (
                          <ResizeHandle
                            header={header}
                            onResizeStart={freezeWidths}
                            onReset={resetColumnSizing}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading && !data ? (
                Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                  <TableRow key={i} className="hover:bg-transparent">
                    {leafColumns.map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={rowClassName?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          fixedCell,
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={leafColumns.length}>
                    <Empty className="py-10">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <InboxIcon />
                        </EmptyMedia>
                        <EmptyTitle>{messages.emptyTitle}</EmptyTitle>
                        <EmptyDescription>
                          {messages.emptyDescription}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {showPagination && (
          <Pagination
            table={table}
            rowCount={server?.rowCount ?? data?.length ?? 0}
          />
        )}
      </div>
    </MessagesContext.Provider>
  );
}

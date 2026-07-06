<?php

namespace App\Services;

use App\Http\Requests\Api\Admin\StoreBatchMenuItemsRequest;
use App\Http\Requests\Api\Admin\StoreMenuItemRequest;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AdminMenuService
{
    public function __construct(private readonly AdminAuditLogger $audit)
    {
    }

    public function list(string $category = '', string $search = ''): array
    {
        $items = MenuItem::query()
            ->when($category !== '', fn ($query) => $query->where('category', $category))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%");
                });
            })
            ->orderBy('category')
            ->orderBy('name')
            ->paginate(15);

        return [
            'categories' => MenuCategory::query()
                ->where('is_active', true)
                ->whereHas('items')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'items' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
        ];
    }

    public function create(StoreMenuItemRequest $request): MenuItem
    {
        $item = MenuItem::create($this->menuData($request));
        $this->audit->record($request->user(), 'menu.created', $item, null, $item->toArray());

        return $item;
    }

    public function createBatch(StoreBatchMenuItemsRequest $request): \Illuminate\Support\Collection
    {
        $data = $request->validated();
        $storedPaths = [];

        try {
            return DB::transaction(function () use ($request, $data, &$storedPaths) {
                $category = $this->resolveMenuCategory($data['category_id'] ?? null, $data['category_name'] ?? null);
                $created = collect();

                foreach ($data['items'] as $index => $itemData) {
                    $payload = [
                        'category_id' => $category->id,
                        'category' => $category->name,
                        'name' => trim($itemData['name']),
                        'description' => filled($itemData['description'] ?? null) ? trim($itemData['description']) : null,
                        'price' => $itemData['price'],
                        'display_price' => filled($itemData['display_price'] ?? null) ? trim($itemData['display_price']) : null,
                        'is_available' => (bool) $itemData['is_available'],
                    ];

                    if ($request->hasFile("items.$index.image")) {
                        $payload['image_path'] = $request->file("items.$index.image")->store('menu-items', 'public');
                        $storedPaths[] = $payload['image_path'];
                    }

                    $item = MenuItem::create($payload);
                    $this->audit->record($request->user(), 'menu.created', $item, null, $item->toArray());
                    $created->push($item);
                }

                return $created;
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($storedPaths);
            throw $exception;
        }
    }

    public function update(StoreMenuItemRequest $request, MenuItem $menuItem): MenuItem
    {
        $before = $menuItem->toArray();
        $menuItem->update($this->menuData($request, $menuItem));
        $fresh = $menuItem->fresh();
        $this->audit->record($request->user(), 'menu.updated', $menuItem, $before, $fresh->toArray());

        return $fresh;
    }

    public function archive(Request $request, MenuItem $menuItem): void
    {
        $inUse = $menuItem->orderItems()
            ->whereHas('order', fn ($query) => $query->whereNull('completed_at')->where('status', '!=', 'void'))
            ->exists();

        if ($inUse) {
            throw ValidationException::withMessages(['item' => 'Món này đang nằm trong một đơn chưa hoàn tất. Bạn có thể tạm ẩn món và xóa sau nhé.']);
        }

        $this->audit->record($request->user(), 'menu.archived', $menuItem, $menuItem->toArray(), null);
        $menuItem->delete();
    }

    private function menuData(StoreMenuItemRequest $request, ?MenuItem $item = null): array
    {
        $data = $request->validated();

        unset($data['image'], $data['remove_image']);

        $category = $this->resolveMenuCategory($data['category_id'] ?? null, $data['category'] ?? null);
        $data['category_id'] = $category->id;
        $data['category'] = $category->name;

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('menu-items', 'public');
            if ($item?->image_path) {
                Storage::disk('public')->delete($item->image_path);
            }
            $data['image_path'] = $path;
        } elseif ($item?->image_path && $request->boolean('remove_image')) {
            Storage::disk('public')->delete($item->image_path);
            $data['image_path'] = null;
        }

        return $data;
    }

    private function resolveMenuCategory(int|string|null $categoryId, ?string $categoryName): MenuCategory
    {
        if ($categoryId) {
            return MenuCategory::query()->where('is_active', true)->findOrFail($categoryId);
        }

        $name = preg_replace('/\s+/u', ' ', trim((string) $categoryName));

        return MenuCategory::firstOrCreate(
            ['name' => $name],
            ['sort_order' => (int) MenuCategory::max('sort_order') + 1, 'is_active' => true],
        );
    }
}

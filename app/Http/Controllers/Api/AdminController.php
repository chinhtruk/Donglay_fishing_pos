<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Admin\AdjustmentReasonRequest;
use App\Http\Requests\Api\Admin\DashboardRangeRequest;
use App\Http\Requests\Api\Admin\StoreBatchMenuItemsRequest;
use App\Http\Requests\Api\Admin\StoreMapSlotRequest;
use App\Http\Requests\Api\Admin\StoreMenuItemRequest;
use App\Http\Requests\Api\Admin\StorePaymentMethodRequest;
use App\Http\Requests\Api\Admin\StoreUserRequest;
use App\Http\Requests\Api\Admin\UpdateMapRequest;
use App\Http\Requests\Api\Admin\UpdatePaymentSettingsRequest;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentQrSetting;
use App\Models\User;
use App\Services\AdminAuditLogger;
use App\Services\AdminDashboardService;
use App\Services\AdminMapService;
use App\Services\AdminMenuService;
use App\Services\AdminPaymentMethodService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    public function dashboard(DashboardRangeRequest $request, AdminDashboardService $dashboard): JsonResponse
    {
        return response()->json($dashboard->build($request->date('from'), $request->date('to')));
    }

    public function menu(Request $request, AdminMenuService $menu): JsonResponse
    {
        $category = trim((string) $request->input('category', ''));
        $search = trim((string) $request->input('q', ''));

        return response()->json($menu->list($category, $search));
    }

    public function paymentSettings(AdminPaymentMethodService $payments): JsonResponse
    {
        return response()->json($payments->settingsPayload());
    }

    public function updatePaymentSettings(UpdatePaymentSettingsRequest $request, AdminPaymentMethodService $payments): JsonResponse
    {
        return response()->json($payments->updateSettings($request));
    }

    public function storePaymentMethod(StorePaymentMethodRequest $request, AdminPaymentMethodService $payments): JsonResponse
    {
        return response()->json($payments->create($request), 201);
    }

    public function updatePaymentMethod(StorePaymentMethodRequest $request, PaymentQrSetting $paymentMethod, AdminPaymentMethodService $payments): JsonResponse
    {
        return response()->json($payments->update($request, $paymentMethod));
    }

    public function storeMenu(StoreMenuItemRequest $request, AdminMenuService $menu): JsonResponse
    {
        $item = $menu->create($request);

        return response()->json(['message' => 'Món mới đã sẵn sàng trên menu.', 'item' => $item], 201);
    }

    public function storeMenuBatch(StoreBatchMenuItemsRequest $request, AdminMenuService $menu): JsonResponse
    {
        $items = $menu->createBatch($request);

        return response()->json([
            'message' => $items->count() === 1
                ? 'Món mới đã sẵn sàng trên menu.'
                : "Đã thêm {$items->count()} món vào cùng nhóm.",
            'items' => $items,
        ], 201);
    }

    public function updateMenu(StoreMenuItemRequest $request, MenuItem $menuItem, AdminMenuService $menu): JsonResponse
    {
        $item = $menu->update($request, $menuItem);

        return response()->json(['message' => 'Thông tin món đã được cập nhật.', 'item' => $item]);
    }

    public function deleteMenu(Request $request, MenuItem $menuItem, AdminMenuService $menu): JsonResponse
    {
        $menu->archive($request, $menuItem);

        return response()->json(['message' => 'Món đã được lưu vào kho lưu trữ.']);
    }

    public function map(AdminMapService $map): JsonResponse
    {
        return response()->json($map->payload());
    }

    public function updateMap(UpdateMapRequest $request, AdminMapService $map): JsonResponse
    {
        $map->update($request);

        return response()->json(['message' => 'Sơ đồ đã được lưu.']);
    }

    public function storeMapSlot(StoreMapSlotRequest $request, AdminMapService $map): JsonResponse
    {
        $slot = $map->createSlot($request);

        return response()->json(['message' => 'Đã thêm thành công.', 'slot' => $slot], 201);
    }

    public function deleteMapSlot(Request $request, string $type, int $id, AdminMapService $map): JsonResponse
    {
        $map->deleteSlot($request, $type, $id);

        return response()->json(['message' => 'Đã xóa thành công.']);
    }

    public function users(): JsonResponse
    {
        return response()->json(['users' => User::orderBy('name')->get()]);
    }

    public function storeUser(StoreUserRequest $request): JsonResponse
    {
        $data = $this->userData($request);
        $verified = (bool) ($data['email_verified'] ?? true);
        unset($data['email_verified']);
        if ($data['role'] === 'admin' && empty($data['password'])) {
            throw ValidationException::withMessages(['password' => 'Tài khoản Admin cần một mật khẩu để bắt đầu nhé.']);
        }
        $user = User::create($data + ['email_verified_at' => isset($data['email']) && $verified ? now() : null]);
        $this->audit($request, 'user.created', $user, null, $user->toArray());

        return response()->json(['message' => 'Tài khoản mới đã sẵn sàng.', 'user' => $user], 201);
    }

    public function updateUser(StoreUserRequest $request, User $user): JsonResponse
    {
        $before = $user->toArray();
        $data = $this->userData($request, $user);
        $verified = (bool) ($data['email_verified'] ?? false);
        unset($data['email_verified']);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        if (($data['is_active'] ?? true) === false && $request->user()->is($user)) {
            throw ValidationException::withMessages(['is_active' => 'Bạn đang dùng tài khoản này, nên mình sẽ giữ tài khoản hoạt động để tránh khóa nhầm nhé.']);
        }
        $data['email_verified_at'] = isset($data['email']) && $verified ? ($user->email_verified_at ?? now()) : null;
        $user->update($data);
        $this->audit($request, 'user.updated', $user, $before, $user->fresh()->toArray());

        return response()->json(['message' => 'Tài khoản đã được cập nhật.', 'user' => $user->fresh()]);
    }

    public function voidOrder(AdjustmentReasonRequest $request, Order $order): JsonResponse
    {
        $data = $request->validated();
        if (! in_array($order->status, ['open', 'partially_paid'], true)) {
            throw ValidationException::withMessages(['order' => 'Đơn này đã khép lại nên không thể hủy trực tiếp.']);
        }
        if ($order->payments()->where('status', 'completed')->exists()) {
            throw ValidationException::withMessages(['order' => 'Đơn đã có thanh toán. Bạn hãy đảo thanh toán trước để sổ sách luôn rõ ràng nhé.']);
        }
        DB::transaction(function () use ($request, $order, $data) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $before = $locked->toArray();
            $locked->update(['status' => 'void', 'voided_at' => now(), 'void_reason' => $data['reason'], 'version' => $locked->version + 1]);
            $locked->fishingSession()->update(['status' => 'completed', 'completed_at' => now()]);
            $this->audit($request, 'order.voided', $locked, $before, $locked->fresh()->toArray(), $data['reason']);
        });

        return response()->json(['message' => 'Đơn đã được hủy và ghi lại lý do đầy đủ.']);
    }

    public function reversePayment(AdjustmentReasonRequest $request, Payment $payment): JsonResponse
    {
        $data = $request->validated();
        if ($payment->status !== 'completed') {
            throw ValidationException::withMessages(['payment' => 'Giao dịch này đã được điều chỉnh trước đó rồi.']);
        }
        DB::transaction(function () use ($request, $payment, $data) {
            $locked = Payment::lockForUpdate()->findOrFail($payment->id);
            $before = $locked->toArray();
            $locked->update(['status' => 'reversed']);
            DB::table('payment_adjustments')->insert(['payment_id' => $locked->id, 'created_by' => $request->user()->id, 'amount' => -((float) $locked->amount), 'reason' => $data['reason'], 'created_at' => now()]);
            $locked->order()->update(['status' => 'payment_exception', 'version' => DB::raw('version + 1')]);
            $this->audit($request, 'payment.reversed', $locked, $before, $locked->fresh()->toArray(), $data['reason']);
        });

        return response()->json(['message' => 'Giao dịch đã được đảo và chuyển sang mục cần đối soát.']);
    }

    private function userData(StoreUserRequest $request, ?User $user = null): array
    {
        return $request->validated();
    }

    private function audit(Request $request, string $action, object $model, ?array $before, ?array $after, ?string $reason = null): void
    {
        app(AdminAuditLogger::class)->record($request->user(), $action, $model, $before, $after, $reason);
    }
}

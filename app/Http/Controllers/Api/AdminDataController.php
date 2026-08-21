<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Admin\BackupAndClearDataRequest;
use App\Services\AdminAuditLogger;
use App\Services\AdminDataManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminDataController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $email = $request->user()->email;

        return response()->json([
            'backup_email' => $email,
            'can_backup' => filter_var($email, FILTER_VALIDATE_EMAIL) !== false,
        ]);
    }

    public function backup(Request $request, AdminDataManagementService $data): JsonResponse
    {
        $email = $data->backup($request->user());

        return response()->json(['message' => "Bản sao lưu đã được gửi đến {$email}. File tạm trên server đã được xóa."]);
    }

    public function backupAndClear(BackupAndClearDataRequest $request, AdminDataManagementService $data, AdminAuditLogger $audit): JsonResponse
    {
        // Double-confirm: require current password re-entry
        if (! Hash::check($request->input('password'), $request->user()->password)) {
            throw ValidationException::withMessages(['password' => 'Mật khẩu chưa đúng. Vui lòng thử lại.']);
        }

        $deleted = $data->backupAndClearOperationalData($request->user());

        // Audit the destructive action
        DB::table('audit_logs')->insert([
            'user_id' => $request->user()->id,
            'action' => 'data.backup_and_clear',
            'auditable_type' => $request->user()::class,
            'auditable_id' => $request->user()->id,
            'before' => json_encode(['deleted_counts' => $deleted]),
            'after' => null,
            'reason' => 'BACKUP_AND_CLEAR confirmed with password',
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => "Đã gửi bản sao lưu đến {$request->user()->email} và xóa dữ liệu vận hành.",
            'deleted' => $deleted,
        ]);
    }
}

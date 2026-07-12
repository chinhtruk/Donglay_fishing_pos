<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Admin\BackupAndClearDataRequest;
use App\Services\AdminDataManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function backupAndClear(BackupAndClearDataRequest $request, AdminDataManagementService $data): JsonResponse
    {
        $deleted = $data->backupAndClearOperationalData($request->user());

        return response()->json([
            'message' => "Đã gửi bản sao lưu đến {$request->user()->email} và xóa dữ liệu vận hành.",
            'deleted' => $deleted,
        ]);
    }
}

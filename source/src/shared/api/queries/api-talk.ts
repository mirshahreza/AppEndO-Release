import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "../client";

export type HttpWorkshopMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type HttpWorkshopKeyValue = { key: string; value: string; enabled: boolean };
export type HttpWorkshopAuthKind = "inherit" | "none" | "apiKey" | "bearer" | "basic" | "customHeaders";
export type HttpWorkshopBodyMode = "none" | "json" | "raw";

export type HttpWorkshopAuthInput = {
  kind: HttpWorkshopAuthKind;
  apiKeyHeaderName?: string;
  basicUsername?: string;
  secretPlaintext?: string;
  customHeaders?: Array<{ name: string; value: string }>;
};

export type RunAdHocRequestInput = {
  method: HttpWorkshopMethod;
  url: string;
  queryParams?: HttpWorkshopKeyValue[];
  headers?: HttpWorkshopKeyValue[];
  bodyMode?: HttpWorkshopBodyMode;
  bodyRaw?: string;
  auth?: HttpWorkshopAuthInput;
  savedRequestId?: string;
  assertions?: HttpWorkshopAssertion[];
};

export type AssertionOutcome = { assertion: HttpWorkshopAssertion; passed: boolean; message: string };

export type RunAdHocRequestResult = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  truncated: boolean;
  sentRequest?: {
    method: HttpWorkshopMethod;
    url: string;
    headerNames: string[];
    bodyByteLength: number;
  };
  assertionResults?: AssertionOutcome[];
};

type ApiTalkRunResponse = { success: boolean; error?: string } & RunAdHocRequestResult;

async function postApiTalkRun(path: string, body?: unknown): Promise<RunAdHocRequestResult> {
  const { data, response } = await apiPost<ApiTalkRunResponse>(path, body);
  if (!response.ok || data.success === false) {
    throw new ApiError(
      typeof data.error === "string" && data.error.trim() ? data.error : "HTTP request failed.",
      {
        status: response.status,
        statusText: response.statusText,
        bodySnippet: typeof data.error === "string" ? data.error : "",
        path,
      },
    );
  }
  return data;
}

export const useRunAdHocRequestMutation = () => useMutation({
  mutationFn: async (input: RunAdHocRequestInput) => postApiTalkRun("/api/api-talk/run-adhoc", input),
});

export type HttpWorkshopAuth = {
  kind: HttpWorkshopAuthKind;
  apiKeyHeaderName?: string;
  basicUsername?: string;
  hasSecret: boolean;
  customHeaders?: Array<{ name: string; value: string }>;
};

export type HttpWorkshopCollection = {
  id: string;
  name: string;
  description?: string;
  auth: HttpWorkshopAuth;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
};

export type HttpWorkshopFolder = {
  id: string;
  collectionId: string;
  parentFolderId: string | null;
  name: string;
  auth: HttpWorkshopAuth;
  sortOrder: number;
};

export type HttpWorkshopAssertion =
  | { kind: "status"; op: "equals" | "in-range"; value: number | [number, number] }
  | { kind: "duration"; op: "lt"; ms: number }
  | { kind: "header"; name: string; op: "exists" | "equals"; value?: string }
  | { kind: "jsonPath"; path: string; op: "exists" | "equals" | "contains"; value?: unknown };

export type HttpWorkshopRequestSummary = {
  id: string;
  collectionId: string;
  folderId: string | null;
  name: string;
  method: HttpWorkshopMethod;
  url: string;
  queryParams: HttpWorkshopKeyValue[];
  headers: HttpWorkshopKeyValue[];
  bodyMode: "none" | "json" | "raw" | "form-urlencoded" | "multipart";
  bodyRaw?: string;
  auth: HttpWorkshopAuth;
  assertions: HttpWorkshopAssertion[];
  sortOrder: number;
};

const collectionsKey = ["api-talk", "collections"] as const;
const foldersKey = (collectionId: string) => ["api-talk", "folders", collectionId] as const;
const requestsKey = (collectionId: string) => ["api-talk", "requests", collectionId] as const;

export const useHttpWorkshopCollectionsQuery = () => useQuery({
  queryKey: collectionsKey,
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: HttpWorkshopCollection[] }>("/api/api-talk/collections");
    return data.items ?? [];
  },
});

export type CreateCollectionInput = { name: string; description?: string; auth?: HttpWorkshopAuthInput };
export const useCreateHttpWorkshopCollectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCollectionInput) => {
      const { data } = await apiPost<{ success: boolean; item: HttpWorkshopCollection }>("/api/api-talk/collections", input);
      return data.item;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: collectionsKey }); },
  });
};

export const useUpdateHttpWorkshopCollectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CreateCollectionInput> & { id: string }) => {
      const { data } = await apiPatch<{ success: boolean; item: HttpWorkshopCollection }>(`/api/api-talk/collections/${id}`, patch);
      return data.item;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: collectionsKey }); },
  });
};

export const useDeleteHttpWorkshopCollectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiDelete(`/api/api-talk/collections/${id}`); },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: collectionsKey }); },
  });
};

export const useHttpWorkshopFoldersQuery = (collectionId: string | null) => useQuery({
  queryKey: foldersKey(collectionId ?? ""),
  enabled: Boolean(collectionId),
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: HttpWorkshopFolder[] }>(`/api/api-talk/collections/${collectionId}/folders`);
    return data.items ?? [];
  },
});

export type CreateFolderInput = { collectionId: string; parentFolderId?: string | null; name: string; auth?: HttpWorkshopAuthInput };
export const useCreateHttpWorkshopFolderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, ...rest }: CreateFolderInput) => {
      const { data } = await apiPost<{ success: boolean; item: HttpWorkshopFolder }>(`/api/api-talk/collections/${collectionId}/folders`, rest);
      return data.item;
    },
    onSuccess: (_item, variables) => { void queryClient.invalidateQueries({ queryKey: foldersKey(variables.collectionId) }); },
  });
};

export const useUpdateHttpWorkshopFolderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collectionId, ...patch }: { id: string; collectionId: string; name?: string; parentFolderId?: string | null; auth?: HttpWorkshopAuthInput }) => {
      const { data } = await apiPatch<{ success: boolean; item: HttpWorkshopFolder }>(`/api/api-talk/folders/${id}`, patch);
      return data.item;
    },
    onSuccess: (_item, variables) => { void queryClient.invalidateQueries({ queryKey: foldersKey(variables.collectionId) }); },
  });
};

export const useDeleteHttpWorkshopFolderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; collectionId: string }) => { await apiDelete(`/api/api-talk/folders/${id}`); },
    onSuccess: (_result, variables) => { void queryClient.invalidateQueries({ queryKey: foldersKey(variables.collectionId) }); },
  });
};

export const useHttpWorkshopRequestsQuery = (collectionId: string | null) => useQuery({
  queryKey: requestsKey(collectionId ?? ""),
  enabled: Boolean(collectionId),
  queryFn: async () => {
    const { data } = await apiGet<{ success: boolean; items: HttpWorkshopRequestSummary[] }>(`/api/api-talk/collections/${collectionId}/requests`);
    return data.items ?? [];
  },
});

export type CreateWorkshopRequestInput = {
  collectionId: string;
  folderId?: string | null;
  name: string;
  method: HttpWorkshopMethod;
  url: string;
  queryParams?: HttpWorkshopKeyValue[];
  headers?: HttpWorkshopKeyValue[];
  bodyMode?: HttpWorkshopBodyMode;
  bodyRaw?: string;
  auth?: HttpWorkshopAuthInput;
  assertions?: HttpWorkshopAssertion[];
};

export const useCreateHttpWorkshopRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, ...rest }: CreateWorkshopRequestInput) => {
      const { data } = await apiPost<{ success: boolean; item: HttpWorkshopRequestSummary }>(`/api/api-talk/collections/${collectionId}/requests`, rest);
      return data.item;
    },
    onSuccess: (_item, variables) => { void queryClient.invalidateQueries({ queryKey: requestsKey(variables.collectionId) }); },
  });
};

export type UpdateWorkshopRequestInput = Partial<Omit<CreateWorkshopRequestInput, "collectionId">> & { id: string; collectionId: string };
export const useUpdateHttpWorkshopRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collectionId, ...patch }: UpdateWorkshopRequestInput) => {
      const { data } = await apiPatch<{ success: boolean; item: HttpWorkshopRequestSummary }>(`/api/api-talk/requests/${id}`, patch);
      return data.item;
    },
    onSuccess: (_item, variables) => { void queryClient.invalidateQueries({ queryKey: requestsKey(variables.collectionId) }); },
  });
};

export const useDeleteHttpWorkshopRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; collectionId: string }) => { await apiDelete(`/api/api-talk/requests/${id}`); },
    onSuccess: (_result, variables) => { void queryClient.invalidateQueries({ queryKey: requestsKey(variables.collectionId) }); },
  });
};

export const useDuplicateHttpWorkshopCollectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiPost<{ success: boolean; item: HttpWorkshopCollection }>(`/api/api-talk/collections/${id}/duplicate`, {});
      return data.item;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: collectionsKey }); },
  });
};

export const useDuplicateHttpWorkshopFolderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collectionId }: { id: string; collectionId: string }) => {
      const { data } = await apiPost<{ success: boolean; item: HttpWorkshopFolder }>(`/api/api-talk/folders/${id}/duplicate`, {});
      return data.item;
    },
    onSuccess: (_item, variables) => {
      void queryClient.invalidateQueries({ queryKey: foldersKey(variables.collectionId) });
      void queryClient.invalidateQueries({ queryKey: requestsKey(variables.collectionId) });
    },
  });
};

export const useDuplicateHttpWorkshopRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; collectionId: string }) => {
      const { data } = await apiPost<{ success: boolean; item: HttpWorkshopRequestSummary }>(`/api/api-talk/requests/${id}/duplicate`, {});
      return data.item;
    },
    onSuccess: (_item, variables) => { void queryClient.invalidateQueries({ queryKey: requestsKey(variables.collectionId) }); },
  });
};

export const useRunSavedHttpWorkshopRequestMutation = () => useMutation({
  mutationFn: async (input: { id: string }) => postApiTalkRun(`/api/api-talk/requests/${input.id}/run`, {}),
});

export const useImportOpenApiMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { specText?: string; specUrl?: string; targetCollectionId?: string }) => {
      const { data } = await apiPost<{ success: boolean; collectionId: string; requestCount: number }>("/api/api-talk/import/openapi", input);
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: collectionsKey });
      void queryClient.invalidateQueries({ queryKey: requestsKey(data.collectionId) });
    },
  });
};

export const useImportPostmanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; targetCollectionId?: string }) => {
      const { data } = await apiPost<{ success: boolean; collectionId: string; requestCount: number }>("/api/api-talk/import/postman", input);
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: collectionsKey });
      void queryClient.invalidateQueries({ queryKey: requestsKey(data.collectionId) });
      void queryClient.invalidateQueries({ queryKey: foldersKey(data.collectionId) });
    },
  });
};

export const useImportCurlMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; targetCollectionId?: string; folderId?: string | null }) => {
      const { data } = await apiPost<{ success: boolean; collectionId: string; requestId: string }>("/api/api-talk/import/curl", input);
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: collectionsKey });
      void queryClient.invalidateQueries({ queryKey: requestsKey(data.collectionId) });
    },
  });
};

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  MoreVertical,
  Trash2,
  Download,
  MessageSquare,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime, formatFileSize } from '@/lib/utils';
import type { Document } from '@/types';

interface DocumentListProps {
  documents: Document[];
  selectedDocuments: string[];
  onSelectionChange: (ids: string[]) => void;
  getStatusBadge: (status: Document['status']) => ReactNode;
  getFileIcon: (type: Document['type']) => string;
}

export function DocumentList({
  documents,
  selectedDocuments,
  onSelectionChange,
  getStatusBadge,
  getFileIcon,
}: DocumentListProps) {
  const toggleSelection = (id: string) => {
    if (selectedDocuments.includes(id)) {
      onSelectionChange(selectedDocuments.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedDocuments, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.length === documents.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(documents.map((d) => d.id));
    }
  };

  const isAllSelected = documents.length > 0 && selectedDocuments.length === documents.length;
  const isSomeSelected = selectedDocuments.length > 0 && selectedDocuments.length < documents.length;

  return (
    <Card>
      <CardContent className="p-0">
        {/* Table Header */}
        <div className="flex items-center px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-4 flex-1">
            <Checkbox
              checked={isAllSelected}
              // @ts-ignore - indeterminate is valid but not in types
              indeterminate={isSomeSelected}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium text-gray-500 w-[40%]">Name</span>
            <span className="text-sm font-medium text-gray-500 w-[15%]">Type</span>
            <span className="text-sm font-medium text-gray-500 w-[15%]">Size</span>
            <span className="text-sm font-medium text-gray-500 w-[15%]">Status</span>
            <span className="text-sm font-medium text-gray-500 w-[15%]">Uploaded</span>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Selected Actions Bar */}
        {selectedDocuments.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b">
            <span className="text-sm text-blue-700">
              {selectedDocuments.length} document{selectedDocuments.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-blue-700">
                <MessageSquare className="h-4 w-4 mr-1" />
                Chat with Selected
              </Button>
              <Button variant="ghost" size="sm" className="text-blue-700">
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Document Rows */}
        <div className="divide-y">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center gap-4 flex-1">
                {/* Checkbox */}
                <Checkbox
                  checked={selectedDocuments.includes(doc.id)}
                  onCheckedChange={() => toggleSelection(doc.id)}
                />

                {/* Name */}
                <Link
                  href={`/documents/${doc.id}`}
                  className="flex items-center gap-3 w-[40%] min-w-0 group/link"
                >
                  <div className={`p-2 rounded-lg ${getFileIcon(doc.type)}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-gray-900 truncate group-hover/link:text-blue-600 transition-colors">
                    {doc.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                </Link>

                {/* Type */}
                <div className="w-[15%]">
                  <span className="text-sm text-gray-600 uppercase">{doc.type}</span>
                </div>

                {/* Size */}
                <div className="w-[15%]">
                  <span className="text-sm text-gray-600">
                    {formatFileSize(doc.metadata.size)}
                  </span>
                  {doc.metadata.pages && (
                    <span className="text-xs text-gray-400 ml-1">
                      • {doc.metadata.pages} pages
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="w-[15%]">{getStatusBadge(doc.status)}</div>

                {/* Uploaded */}
                <div className="w-[15%]">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(doc.created_at)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/documents/${doc.id}`}>
                      <Eye className="h-4 w-4 mr-2" /> View Document
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/chat?doc=${doc.id}`}>
                      <MessageSquare className="h-4 w-4 mr-2" /> Chat with Document
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" /> Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

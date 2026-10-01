#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import <PDFKit/PDFKit.h>

@interface PDFExporter : NSObject <WKNavigationDelegate>
@property (strong) WKWebView *webView;
@property (strong) NSString *outputPath;
@property (assign) CGFloat fallbackWidth;
@property (assign) CGFloat fallbackHeight;
@end

@implementation PDFExporter

- (instancetype)initWithWidth:(CGFloat)width height:(CGFloat)height {
    self = [super init];
    if (self) {
        self.fallbackWidth = width > 0 ? width : 794.0;
        self.fallbackHeight = height > 0 ? height : 1123.0;
        WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
        self.webView = [[WKWebView alloc] initWithFrame:NSMakeRect(0, 0, self.fallbackWidth, self.fallbackHeight) configuration:config];
        self.webView.navigationDelegate = self;
    }
    return self;
}

- (void)exportHTML:(NSString *)html baseURL:(NSURL *)baseURL toPath:(NSString *)outputPath {
    self.outputPath = outputPath;
    [self.webView loadHTMLString:html baseURL:baseURL];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    // Wait for KaTeX formulas, web fonts and SVG rendering to settle
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(600 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
        if (@available(macOS 11.0, *)) {
            // Introspect exact paper dimensions and explicit .exam-page count from DOM
            NSString *dimScript = @"(function() {"
                                   "  var target = document.querySelector('.problem-paper-sheet, .export-card, .problem-export-card, .problem-card');"
                                   "  if (target) {"
                                   "    var rect = target.getBoundingClientRect();"
                                   "    var w = Math.round(rect.width || target.offsetWidth || 880);"
                                   "    var h = Math.round(rect.height || target.scrollHeight || 400);"
                                   "    var x = Math.round(rect.left || 0);"
                                   "    var y = Math.round(rect.top || 0);"
                                   "    return { width: w, pageHeight: h, totalHeight: h, pageCount: 1, x: x, y: y };"
                                   "  }"
                                   "  var pages = document.querySelectorAll('.exam-page');"
                                   "  var b = document.body;"
                                   "  var d = document.documentElement;"
                                   "  var w = Math.round(b.offsetWidth || d.offsetWidth || 794);"
                                   "  var minH = parseFloat(getComputedStyle(b).minHeight) || 0;"
                                   "  var pageH = Math.round(minH > 0 ? minH : 1123);"
                                   "  var scrollH = Math.max(b.scrollHeight, d.scrollHeight, pageH);"
                                   "  var count = pages.length > 0 ? pages.length : Math.max(1, Math.ceil(scrollH / pageH));"
                                   "  return { width: w, pageHeight: pageH, totalHeight: count * pageH, pageCount: count, x: 0, y: 0 };"
                                   "})()";
            
            [self.webView evaluateJavaScript:dimScript completionHandler:^(id result, NSError *jsError) {
                CGFloat targetW = self.fallbackWidth;
                CGFloat pageH = self.fallbackHeight;
                CGFloat totalH = pageH;
                CGFloat targetX = 0;
                CGFloat targetY = 0;
                int pageCount = 1;
                
                if ([result isKindOfClass:[NSDictionary class]]) {
                    NSDictionary *dict = (NSDictionary *)result;
                    if (dict[@"width"]) targetW = [dict[@"width"] doubleValue];
                    if (dict[@"pageHeight"]) pageH = [dict[@"pageHeight"] doubleValue];
                    if (dict[@"totalHeight"]) totalH = [dict[@"totalHeight"] doubleValue];
                    if (dict[@"pageCount"]) pageCount = [dict[@"pageCount"] intValue];
                    if (dict[@"x"]) targetX = [dict[@"x"] doubleValue];
                    if (dict[@"y"]) targetY = [dict[@"y"] doubleValue];
                }
                
                if (pageCount < 1) {
                    pageCount = (int)ceil(totalH / pageH);
                }
                if (pageCount < 1) pageCount = 1;
                
                // Adjust webView frame to cover full content length
                self.webView.frame = NSMakeRect(0, 0, targetW + targetX, pageCount * pageH + targetY);
                
                BOOL isPng = [self.outputPath.lowercaseString hasSuffix:@".png"];
                if (isPng) {
                    WKSnapshotConfiguration *snapConfig = [[WKSnapshotConfiguration alloc] init];
                    snapConfig.rect = NSMakeRect(targetX, targetY, targetW, totalH);
                    snapConfig.snapshotWidth = @(targetW * 2.0);
                    
                    [self.webView takeSnapshotWithConfiguration:snapConfig completionHandler:^(NSImage *snapshotImage, NSError *error) {
                        if (error || !snapshotImage) {
                            fprintf(stderr, "Snapshot Error: %s\n", error.localizedDescription.UTF8String);
                            exit(1);
                        }
                        NSData *tiffData = [snapshotImage TIFFRepresentation];
                        NSBitmapImageRep *rep = [NSBitmapImageRep imageRepWithData:tiffData];
                        NSData *pngData = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
                        BOOL success = [pngData writeToFile:self.outputPath atomically:YES];
                        if (success) {
                            printf("SUCCESS: %s\n", self.outputPath.UTF8String);
                            exit(0);
                        } else {
                            fprintf(stderr, "Failed to write PNG file to destination\n");
                            exit(2);
                        }
                    }];
                    return;
                }

                if (pageCount == 1) {
                    // Single page: capture exact single page
                    WKPDFConfiguration *pdfConfig = [[WKPDFConfiguration alloc] init];
                    pdfConfig.rect = NSMakeRect(0, 0, targetW, pageH);
                    
                    [self.webView createPDFWithConfiguration:pdfConfig completionHandler:^(NSData *pdfData, NSError *error) {
                        if (error) {
                            fprintf(stderr, "PDF Creation Error: %s\n", error.localizedDescription.UTF8String);
                            exit(1);
                        }
                        BOOL success = [pdfData writeToFile:self.outputPath atomically:YES];
                        if (success) {
                            printf("SUCCESS: %s\n", self.outputPath.UTF8String);
                            exit(0);
                        } else {
                            fprintf(stderr, "Failed to write PDF file to destination\n");
                            exit(2);
                        }
                    }];
                } else {
                    // Multi-page document: sequentially capture each page slice into PDFDocument
                    PDFDocument *finalDoc = [[PDFDocument alloc] init];
                    [self renderSlice:0 pageCount:pageCount pageW:targetW pageH:pageH intoDocument:finalDoc];
                }
            }];
        } else {
            fprintf(stderr, "macOS 11.0 or higher is required for native WebKit PDF generation\n");
            exit(3);
        }
    });
}

- (void)renderSlice:(int)pageIndex pageCount:(int)pageCount pageW:(CGFloat)pageW pageH:(CGFloat)pageH intoDocument:(PDFDocument *)finalDoc {
    if (pageIndex >= pageCount) {
        BOOL success = [finalDoc writeToFile:self.outputPath];
        if (success) {
            printf("SUCCESS: %s\n", self.outputPath.UTF8String);
            exit(0);
        } else {
            fprintf(stderr, "Failed to write multi-page PDF file\n");
            exit(2);
        }
        return;
    }
    
    WKPDFConfiguration *cfg = [[WKPDFConfiguration alloc] init];
    cfg.rect = NSMakeRect(0, pageIndex * pageH, pageW, pageH);
    
    [self.webView createPDFWithConfiguration:cfg completionHandler:^(NSData *sliceData, NSError *err) {
        if (err) {
            fprintf(stderr, "Error rendering page %d: %s\n", pageIndex, err.localizedDescription.UTF8String);
            exit(1);
        }
        PDFDocument *sliceDoc = [[PDFDocument alloc] initWithData:sliceData];
        if ([sliceDoc pageCount] > 0) {
            PDFPage *page = [sliceDoc pageAtIndex:0];
            [finalDoc insertPage:page atIndex:[finalDoc pageCount]];
        }
        [self renderSlice:pageIndex + 1 pageCount:pageCount pageW:pageW pageH:pageH intoDocument:finalDoc];
    }];
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    fprintf(stderr, "Navigation error: %s\n", error.localizedDescription.UTF8String);
    exit(4);
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 3) {
            printf("Usage: html2pdf <input_html_path> <output_pdf_path> [width] [height]\n");
            return 1;
        }

        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];

        NSString *inputPath = [NSString stringWithUTF8String:argv[1]];
        NSString *outputPath = [NSString stringWithUTF8String:argv[2]];

        CGFloat width = 794.0;
        CGFloat height = 1123.0;
        if (argc >= 5) {
            width = atof(argv[3]);
            height = atof(argv[4]);
        }

        NSError *readError = nil;
        NSString *htmlContent = [NSString stringWithContentsOfFile:inputPath encoding:NSUTF8StringEncoding error:&readError];
        if (readError) {
            fprintf(stderr, "Error reading input HTML file: %s\n", readError.localizedDescription.UTF8String);
            return 1;
        }

        NSURL *baseURL = [NSURL fileURLWithPath:[inputPath stringByDeletingLastPathComponent]];
        PDFExporter *exporter = [[PDFExporter alloc] initWithWidth:width height:height];
        [exporter exportHTML:htmlContent baseURL:baseURL toPath:outputPath];

        [[NSRunLoop mainRunLoop] run];
    }
    return 0;
}

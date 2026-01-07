import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 書籍販売

 * @memberof 誤打訂正.売上業務
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.TAG_2_TIERS_OF_BOOKS}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・書籍販売の売上取引が誤打訂正により取消ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 書籍商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 7 | 【誤打訂正】支払登録 | `/void/addpayment` |
 * | 8 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_134で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. 書籍商品
 * * \- barcode_1: 9784799313282
 * * \- barcode_2: 1921234010008
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_134 にて確認済み）
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * #### 6.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * \- 書籍商品の取消が可能であり、カート情報に書籍商品が含まれることを確認
 * * * \+ item_cd = 479931328（バーコード1 の 4～12桁）
 * * #### 8.【誤打訂正】取引終了 `/void/end`
 * * \- レシートデータに「誤打訂正」が含まれており、返品金額が販売取引と一致していることを確認
 */
export function TC_040219001_VoidBookSales() {
  group("TC_040219001 書籍販売", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeBookTwoTier: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "書籍商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (現金払い)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
    };

    const bookProdInfo = CommonFunction.createObjectFromBookJanProd(PROD.BOOK_TWO_TIER_1, PROD.BOOK_TWO_TIER_2);

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeBookTwoTier, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BOOK_TWO_TIER_1,
          scan_data_type: "JAN13",
        },
        {
          barcode: PROD.BOOK_TWO_TIER_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify can cancellation of book sales, cart info contains 1 product: 書籍商品",
        expected: true,
        actual: (res) => res.result?.cartinfo?.items?.length === 1 && bookProdInfo?.itemCd === res.result?.cartinfo?.items?.[0]?.item_cd,
      }),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const voidPayment = voidCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);

    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: voidPayment?.paid_group_cd,
      paidCode: voidPayment?.paid_cd,
      paidAmount: voidPayment?.paid_amount,
      details: voidPayment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: 誤打訂正 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(salesCartInfo?.total_balance_amount);
          return CommonFunction.includesItems([
            "誤打訂正",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}

      *----------------------------------------------------------------*
      * STRUCTURE DE LA PARTIE COMMUNE CRO STANDAD PRECEDENT           *
      *           VERSION DE TRAVAIL 1.00                              *
      *           DOCUMENTATION SOUS N:çDEVçGSçDAFCMçCROçACROST12.DOC  *
      *----------------------------------------------------------------*
           05      DSC-PAC-CRO-A.
             10    CD-TYP-ENR          PIC X(1).
             10    CD-CHN-LOT          PIC X(4).
             10    NO-LOT-DER-ATB      PIC 9(4).
             10    RF-CRO-LCA          PIC X(20).
             10    CD-TYP-CRO-AM       PIC X(4).
             10    CD-SEN-CRO          PIC X(1).
             10    NO-ATV              PIC 9(2).
             10    CD-TYP-ATV-AM       PIC X(2).
             10    CD-STT-ATV          PIC X(1).
             10    RF-ATV              PIC X(8).
             10    CD-TYP-PO-RB        PIC X(4).
      *================================================================*        
      * CFGL188 : CHAINE GL18   COPY CRO SPECIFIQUE BDI                *        
      *           (LONGUEUR = 140)   DATE DE CREATION : 04/02/2004     *        
      *================================================================*        
      *    ---> PARTIE SPECIFIQUE                                               
       05  DSC-BDI-CRO-A.                                                       
              10 NAT-SINISTRE                  PIC X(002).                      
              10 NO-SINISTRE                   PIC X(008).                      
              10 CLE-SIN                       PIC X(001).                      
              10 ANNEE-SURV                    PIC X(002).                      
              10 ENTITE-JUR                    PIC X(002).                      
              10 PTF                           PIC X(002).                      
              10 BLOC-NAT                      PIC X(001).
              10 CD-PROD                       PIC X(002).
              10 CDE-OPER                      PIC X(002).
              10 CDE-CAT-CPT                   PIC X(002).
              10 CONTRAT                       PIC X(006).                      
              10 SS-CONTRAT                    PIC X(005).                      
              10 CD-PAYS                       PIC X(001).                      
              10 CD-NAT                        PIC X(001).                      
              10 PART-GAN                      PIC S9(15)V9(2) COMP-3.
              10 PART-AUTRE                    PIC S9(15)V9(2) COMP-3.
              10 CIE-GAR                       PIC X(002).
              10 DT-CPT-CAISSE                 PIC 9(008).
              10 DT-CPT-GL                     PIC 9(008).
              10 PER-CPT                       PIC 9(006).                      
              10 CD-MON                        PIC X(003).                      
              10 MTH-DECAISS                   PIC X(001).                      
              10 MT-PREST                      PIC S9(15)V9(2) COMP-3.          
              10 ORG-COLL                      PIC X(001).
              10 MDE-LIBER                     PIC X(001).
              10 CDE-MARGE-RATIO               PIC X(002).
              10 PRD-CPTABLE                   PIC X(004).
              10 GAR-CPTABLE                   PIC X(004).
              10 INT-CPTABLE                   PIC X(005).                      
              10 NO-RAPP                       PIC X(011).                      
              10 SITE-CAISSE                   PIC X(002).                      